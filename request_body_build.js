const protobuf = require('protobufjs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const protoPath = path.join(__dirname, 'request.proto');

protobuf.load(protoPath)
    .then(root => {
        // 获取指定包下的消息类型
        const Request = root.lookupType('aiserver.v1.Request');
        const Model = root.lookupType('aiserver.v1.Model');
        const Message = root.lookupType('aiserver.v1.Message');

        const userMessage = Message.create({
            message: '你好,你是谁',
            roles: 1, // 1表示user
            uuid: uuidv4()
        });

        const systemMessage = Message.create({
            message: '你好！我是 Claude，一个由 Anthropic 开发的 AI 助手。我可以用中文和你交流，也可以帮你解决编程相关的问题。有什么我可以帮你的吗？\n',
            roles: 2, // 2表示system
            uuid: uuidv4()
        });

        // 创建Model对象
        const model = Model.create({
            model: 'claude-3.5-sonnet',
            unknown: Buffer.from([])
        });

        // 创建Request对象
        const payload = {
            message: [userMessage,systemMessage,userMessage],
            unknown: Buffer.from([]),
            paths: '/c:/Users/Test/.cursor-tutor',
            model: model,
            traceid: 'e2501298-9221-4eb1-971c-ad65797060e4',
            uknown1: 0,
            uknown2: 0,
            uknown3: uuidv4(),
            uknown4: 1,
            uknown5: 0,
            uknown6: 0,
            uknown7: 0,
            uknown8: 0
        };

        const errMsg = Request.verify(payload);
        if (errMsg) throw Error(errMsg);

        const message = Request.create(payload);
        const buffer = Request.encode(message).finish();

        const length = buffer.length;
        const lengthBuffer = Buffer.alloc(5);

        // 使用 writeUIntBE 以大端字节序写入长度
        lengthBuffer.writeUIntBE(length, 0, 5);

        const envelope = Buffer.concat([lengthBuffer, buffer]);

        const outputDir = path.join(__dirname, 'output');
        const binaryFilePath = path.join(outputDir, 'request_with_length.bin');
        const jsonFilePath = path.join(outputDir, 'request.json');

        fs.mkdirSync(outputDir, { recursive: true });

        // 保存包含长度前缀的二进制文件
        fs.writeFileSync(binaryFilePath, envelope);
        console.log(`带长度前缀的二进制请求体已保存到 ${binaryFilePath}`);

        // 保存原始二进制文件
        fs.writeFileSync(path.join(outputDir, 'request.bin'), buffer);
        console.log(`原始二进制请求体已保存到 ${path.join(outputDir, 'request.bin')}`);

        // 保存 JSON 格式
        fs.writeFileSync(jsonFilePath, JSON.stringify(payload, null, 2));
        console.log(`JSON 请求体已保存到 ${jsonFilePath}`);
    })
    .catch(err => {
        console.error('加载 .proto 文件时出错:', err);
    });
