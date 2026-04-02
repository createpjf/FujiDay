const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

function encodeMessage(message) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    ...message
  });

  return `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
}

function createMessageParser(onMessage) {
  let buffer = Buffer.alloc(0);

  return chunk => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const headerText = buffer.slice(0, headerEnd).toString('utf8');
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(headerText);
      if (!lengthMatch) {
        throw new Error('Missing Content-Length header in mock MCP request.');
      }

      const contentLength = Number(lengthMatch[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (buffer.length < bodyEnd) return;

      const bodyText = buffer.slice(bodyStart, bodyEnd).toString('utf8');
      buffer = buffer.slice(bodyEnd);
      onMessage(JSON.parse(bodyText));
    }
  };
}

function createMiniMaxMcpSpawnStub({ onToolCall }) {
  return function spawnStub() {
    const proc = new EventEmitter();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();

    const handleMessage = async message => {
      if (message.method === 'initialize') {
        proc.stdout.write(encodeMessage({
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            serverInfo: {
              name: 'mock-minimax-mcp',
              version: '0.1.0'
            }
          }
        }));
        return;
      }

      if (message.method === 'tools/list') {
        proc.stdout.write(encodeMessage({
          id: message.id,
          result: {
            tools: [
              {
                name: 'understand_image',
                inputSchema: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string' },
                    image_url: { type: 'string' }
                  },
                  required: ['prompt', 'image_url']
                }
              }
            ]
          }
        }));
        return;
      }

      if (message.method === 'tools/call') {
        const args = message.params?.arguments || {};
        const text = await onToolCall({
          prompt: args.prompt,
          imagePath: args.image_url || args.image_source || null
        });

        proc.stdout.write(encodeMessage({
          id: message.id,
          result: {
            content: [
              {
                type: 'text',
                text
              }
            ]
          }
        }));
      }
    };

    const parseInput = createMessageParser(message => {
      Promise.resolve(handleMessage(message)).catch(error => proc.emit('error', error));
    });

    proc.stdin = new Writable({
      write(chunk, _encoding, callback) {
        try {
          parseInput(chunk);
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });

    proc.kill = () => {
      queueMicrotask(() => proc.emit('exit', 0));
      return true;
    };

    return proc;
  };
}

module.exports = {
  createMiniMaxMcpSpawnStub
};
