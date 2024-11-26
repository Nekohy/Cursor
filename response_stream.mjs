import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'node:fs';
import { Buffer } from 'buffer';
// 不需要额外安装 node-fetch，Node.js 18+ 已内置 fetch

const __dirname = dirname(fileURLToPath(import.meta.url));

// 构建文件路径
const filePath = path.join(__dirname, 'output', 'request_with_length.bin');

async function sendRequest() {
    try {
        // 读取整个文件到 Buffer
        const data = await fsPromises.readFile(filePath);
        const fileSize = data.length;
        console.log(`文件大小: ${fileSize} 字节`);

        // 定义分隔符模式：'00000000'
        const delimiterPattern = Buffer.from('00000000', 'hex'); // 4 bytes: 00 00 00 00
        const delimiterLength = delimiterPattern.length;

        // 发起 POST 请求
        const options = {
            method: 'POST',
            headers: {
                'User-Agent': 'connect-es/1.6.1',
                'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSkJZUkFOUUZSMURHMEVXNTkzVFROVzNLIiwidGltZSI6IjE3MzA4MzAyNTgiLCJyYW5kb21uZXNzIjoiNzU4OTIyNzktMTkxZC00NzVlIiwiZXhwIjo0MzIyODMwMjU4LCJpc3MiOiJodHRwczovL2F1dGhlbnRpY2F0aW9uLmN1cnNvci5zaCIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhdWQiOiJodHRwczovL2N1cnNvci5jb20ifQ.CVya5bek2xsh-lgU5DaZUiEA0bBUsQMcb-rJGd6nkMI',
                'connect-accept-encoding': 'gzip,br',
                'connect-protocol-version': '1',
                'content-type': 'application/grpc-web+proto',
                'x-amzn-trace-id': 'Root=e2501298-9221-4eb1-971c-ad65797060e4',
                'x-client-key': 'd49b1266343b31dd26a53b5fc9afdd5eb31936c12b0e1ee105a106b591011262',
                'x-cursor-checksum': 'zMPF4o-Gd2ea6e8d761ab6249652f546fd6d34c81fbbb28e5c42164515f1033b288287a9/f43041a7a83639c58e00fb8665c54eb771ab2bc48686f050ed72f360f771e8e4',
                'x-cursor-client-version': '0.42.4',
                'x-cursor-timezone': 'Asia/Shanghai',
                'x-ghost-mode': 'true',
                'x-request-id': 'e2501298-9221-4eb1-971c-ad65797060e4',
                'Cookie': ''
            },
            body: data, // 直接使用 Buffer 作为请求体
            // 不需要 duplex 选项
        };

        console.log('正在发送请求...');
        const response = await fetch('https://api2.cursor.sh/aiserver.v1.AiService/StreamChat', options);

        if (!response.body) {
            throw new Error('响应没有 body');
        }

        const reader = response.body; // Node.js Readable 流

        let buffer = Buffer.alloc(0);
        let totalChunks = 0;
        let fullbody = "";

        // 使用异步迭代器读取数据
        for await (const chunk of reader) {
            // 将新读取的数据追加到缓冲区
            buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
            // console.log(`缓冲区大小: ${buffer.length} 字节`);

            let delimiterIndex;
            while ((delimiterIndex = buffer.indexOf(delimiterPattern)) !== -1) {
                // 确保分隔符后至少有3个字节以进行检查
                if (buffer.length < delimiterIndex + delimiterLength + 3) {
                    // 数据不足，等待更多数据
                    break;
                }

                // 读取分隔符后的字节
                const byte1 = buffer[delimiterIndex + delimiterLength];
                const byte2 = buffer[delimiterIndex + delimiterLength + 1];
                const byte3 = buffer[delimiterIndex + delimiterLength + 2];

                // 检查第2个字节是否为0A
                if (byte2 !== 0x0A) {
                    // 条件不满足，继续搜索下一个分隔符
                    console.warn(`找到分隔符后，第二个字节不是0A: byte2=${byte2.toString(16)}`);
                    // 移除当前找到的分隔符，继续查找下一个
                    buffer = buffer.slice(delimiterIndex + 1);
                    continue;
                }

                // 检查第1个字节减去2是否等于第3个字节
                if ((byte1 - 2) !== byte3) {
                    // 条件不满足，继续搜索下一个分隔符
                    console.warn(`byte1 - 2 不等于 byte3: byte1=${byte1.toString(16)}, byte3=${byte3.toString(16)}`);
                    // 移除当前找到的分隔符，继续查找下一个
                    buffer = buffer.slice(delimiterIndex + 1);
                    continue;
                }

                // 第3个字节代表的长度
                const length = byte3;
                console.log(`找到有效分隔符: byte1=${byte1.toString(16)}, byte2=0a, byte3=${byte3.toString(16)} (长度=${length})`);

                // 计算数据块的起始和结束位置
                const chunkStart = delimiterIndex + delimiterLength + 3; // 分隔符 + byte1 + byte2 + byte3
                const chunkEnd = chunkStart + length;

                if (buffer.length < chunkEnd) {
                    // 数据块尚未完全接收，等待更多数据
                    console.log('数据块尚未完全接收，等待更多数据...');
                    break;
                }

                // 提取数据块，不包含分隔符的3个字节
                const chunkData = buffer.slice(chunkStart, chunkEnd);
                if (chunkData.length > 0) {
                    totalChunks += 1;
                    console.log(`接收到的数据块 ${totalChunks}:`, chunkData.toString('utf-8')); // 根据需要调整编码
                    fullbody += chunkData.toString('utf-8')
                    // 例如，若数据为二进制，可以使用 chunkData.toString('hex') 或其他合适的编码
                }

                // 从缓冲区中移除已处理的数据和分隔符及相关字节
                buffer = buffer.slice(chunkEnd);
            }

            // 防止缓冲区无限增长，可以根据需要调整
            if (buffer.length > 10 * 1024 * 1024) { // 例如，10 MB
                console.warn('缓冲区过大，清空缓冲区以防内存泄漏');
                buffer = Buffer.alloc(0);
            }
        }

        // 处理剩余缓冲区
        if (buffer.length > 0) {
            console.log('最后一块数据 (可能不完整):', buffer.toString('hex'));
        }

        console.log(`总共接收到 ${totalChunks} 个数据块。`);
        console.log(fullbody)
    } catch (error) {
        console.error('错误:', error);
    }
}

sendRequest();
