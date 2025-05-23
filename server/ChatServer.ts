import express, { Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { httpServerUtil } from '../common/HttpServerUtil.js';
import {controller} from './Contoller.js';
import { rtc } from './WebRTCServer.js';
import { logInit } from './ServerLogger.js';

logInit();

function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is not set`);
    }
    else {
        console.log(`ENV VAR: ${name}==[${value}]`);
    }
    return value;
}

// this HOST will be 'localhost' or else if on prod 'chat.quanta.wiki'
const HOST = getEnvVar("QUANTA_CHAT_HOST");

// This is the port for the web app. It will be 443 for prod, or 80 for dev on localhost
const PORT = getEnvVar("QUANTA_CHAT_PORT");

// This is the port for the web app. It will be 'https' for prod, or 'http' for dev on localho
const SECURE = getEnvVar("QUANTA_CHAT_SECURE");

const ADMIN_PUBLIC_KEY = getEnvVar("QUANTA_CHAT_ADMIN_PUBLIC_KEY");

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Add HTTP to HTTPS redirect if using HTTPS
if (SECURE === 'y') {
    app.use((req, res, next) => {
        // Check if the request is already secure
        if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
            next();
        } else {
            // Redirect to HTTPS
            res.redirect(`https://${HOST}:${PORT}${req.url}`);
        }
    });
}

app.get('/api/rooms/:roomId/message-ids', controller.getMessageIdsForRoom);
app.get('/api/attachments/:attachmentId', controller.serveAttachment);
app.get('/api/messages', controller.getMessageHistory);
app.get('/api/users/:pubKey/info', controller.getUserProfile);
app.get('/api/users/:pubKey/avatar', controller.serveAvatar);

app.post('/api/admin/get-room-info', httpServerUtil.verifyAdminHTTPSignature, controller.getRoomInfo);
app.post('/api/admin/delete-room', httpServerUtil.verifyAdminHTTPSignature, controller.deleteRoom);
app.post('/api/admin/get-recent-attachments', httpServerUtil.verifyAdminHTTPSignature, controller.getRecentAttachments);
app.post('/api/admin/create-test-data', httpServerUtil.verifyAdminHTTPSignature, controller.createTestData);
app.post('/api/admin/block-user', httpServerUtil.verifyAdminHTTPSignature, controller.blockUser);

app.post('/api/attachments/:attachmentId/delete', httpServerUtil.verifyAdminHTTPSignature, controller.deleteAttachment);
app.post('/api/rooms/:roomId/get-messages-by-id', controller.getMessagesByIds);
app.post('/api/users/info', httpServerUtil.verifyReqHTTPSignature, controller.saveUserProfile);
app.post('/api/rooms/:roomId/send-messages',  httpServerUtil.verifyReqHTTPSignature, controller.sendMessages);
app.post('/api/delete-message', httpServerUtil.verifyReqHTTPSignature, controller.deleteMessage); // check PublicKey

// DO NOT DELETE. Keep this as an example of how to implement a secure GET endpoint
// app.get('/recent-attachments', httpServerUtil.verifyAdminHTTPQuerySig, (req: any, res: any) => ...return some HTML);

const serveIndexHtml = (req: Request, res: Response) => {
    fs.readFile("./dist/index.html", 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Error loading page');
        }

        // Replace the placeholders with actual values
        const result = data
            .replace('{{HOST}}', HOST)
            .replace('{{PORT}}', PORT)
            .replace('{{SECURE}}', SECURE)
            .replace('{{ADMIN_PUBLIC_KEY}}', ADMIN_PUBLIC_KEY);

        // Set the content type and send the modified HTML
        res.contentType('text/html');
        res.send(result);
    });
};

// Define HTML routes BEFORE static middleware
// Explicitly serve index.html for root path
app.get('/', serveIndexHtml);

// Serve static files from the dist directory, but disable index serving
app.use(express.static("./dist", { index: false }));

// Fallback for any other routes not handled above
app.get('*', serveIndexHtml);

let server = null;

// PRODUCTION: run on 'https' with certificates
if (SECURE === 'y') {
    try {
        const CERT_PATH = getEnvVar("QUANTA_CHAT_CERT_PATH");
        const key = fs.readFileSync(`${CERT_PATH}/privkey.pem`, 'utf8');
        const cert = fs.readFileSync(`${CERT_PATH}/fullchain.pem`, 'utf8');
        server = https.createServer({key, cert}, app);
    } catch (error: any) {
        console.error('Error setting up HTTPS:', error.message);
        throw error;
    }
}
// LOCALHOST: For development/testing, run on 'http', without certificates
else {
    server = http.createServer(app);
}

server.listen(PORT, () => {
    console.log(`Web Server running on ${HOST}:${PORT}`);
});

rtc.init(HOST, PORT, server);
