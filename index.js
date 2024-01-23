const Database = require('better-sqlite3');
const logger = require('./logger');
const queueHandler = require('./LavinMQWorkerQueueHandler');
const ApiHandler = require('./ApiHandler');
const path = require('path');
const http = require('http');
const PORT = 3000;
class Worker {
    constructor() {
        this.apiHandler = new ApiHandler();
        this.db = new Database(path.join(__dirname, 'chatlog.db'), { verbose: console.log });
        this.initDB();
        this.initializeQueueHandler();
    }

    async initializeQueueHandler() {
        try {
            await queueHandler.initialize();
            queueHandler.consumeImageGenerationTasks(this.executeTask.bind(this));
            logger.info('LavinMQWorkerQueueHandler initialized successfully.');
        } catch (error) {
            logger.error('Failed to initialize LavinMQWorkerQueueHandler:', error);
            this.gracefulShutdown(1);
        }
    }

    async executeTask(msg) {
        if (!msg || !msg.content) {
            logger.warn("Invalid message format received from the queue.");
            return;
        }

        try {
            const jobData = JSON.parse(msg.content.toString());
            if (!jobData.chatId || !jobData.query) {
                logger.error('Job data missing chatId or query.');
                return;
            }

            const response = await this.apiHandler.makeRequest(jobData.chatId, jobData.query);
            if (!response) {
                logger.error(`No response for chatId=${jobData.chatId}, query=${jobData.query}`);
                return;
            }

            this.appendToChatLog(jobData.query, response);

            await queueHandler.sendJobResult({ chatId: jobData.chatId, response });
            logger.info(`Processed job for chatId=${jobData.chatId}`);

        } catch (error) {
            logger.error('Error processing queue message:', error);
        }
    }

    initDB() {
        this.db.prepare('CREATE TABLE IF NOT EXISTS chat_log (prompt TEXT, completion TEXT)').run();
    }

    appendToChatLog(prompt, completion) {
        try {
            const stmt = this.db.prepare('INSERT INTO chat_log (prompt, completion) VALUES (?, ?)');
            stmt.run(prompt, completion);
            logger.info('Successfully appended to the chat log');
        } catch (err) {
            logger.error('Error appending to the chat log', { error: err.message });
        }
    }

    gracefulShutdown(exitCode = 0) {
        logger.info('Initiating graceful shutdown...');
        queueHandler.close().then(() => {
            this.db.close();
            logger.info('Worker shutdown successfully.');
            process.exit(exitCode);
        }).catch(error => {
            logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        });
    }
}

async function initializeWorker() {
    try {
        global.workerInstance = new Worker();
        logger.info('Worker initialized successfully.');

        // Initialize HTTP server with provided module example.
        const server = http.createServer((req, res) => {
            // Define the response for incoming HTTP requests (this is basic and should be expanded as needed)
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('Worker HTTP Server Response');
        });

        server.listen(PORT, () => {
            console.log(`HTTP Server running on http://localhost:${PORT}/`);
        });

    } catch (error) {
        logger.error(`Failed to initialize worker: ${error.message}`);
        process.exit(1);
    }
}

process.on("SIGTERM", () => {
    logger.info('Received SIGTERM. Shutting down gracefully.');
    if (global.workerInstance) {
        global.workerInstance.gracefulShutdown();
    }
});

initializeWorker();