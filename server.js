// Import the necessary libraries
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mqtt = require('mqtt');
const { MongoClient } = require('mongodb');
const cors = require('cors'); // <-- ADD THIS LINE

// --- Configuration ---
const PORT = 3000;
const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'shubhayu/iot/sensor_data';

// --- ADD YOUR MONGODB DETAILS HERE ---
const MONGO_URI = process.env.MONGO_URI;;
const DB_NAME = "disaster_db";
const COLLECTION_NAME = "sensor_readings";

// --- Main Application Logic ---
async function main() {
    console.log("🚀 Starting server...");
    const mongoClient = new MongoClient(MONGO_URI);

    try {
        await mongoClient.connect();
        console.log("✅ Connected successfully to MongoDB Atlas!");
        
        const database = mongoClient.db();
        const collection = database.collection(COLLECTION_NAME);

        // --- Basic Server Setup ---
        const app = express();
        app.use(cors()); // <-- AND ADD THIS LINE
        const server = http.createServer(app);
        const io = new Server(server);

        app.get('/', (req, res) => {
            res.sendFile(__dirname + '/index.html');
        });

        // API Endpoint for the latest sensor data
        app.get('/api/latest', async (req, res) => {
            // ... (this endpoint remains the same)
            console.log("API request received for /api/latest");
            try {
                const latestData = await collection.findOne({}, { sort: { timestamp: -1 } });
                if (latestData) { res.json(latestData); } 
                else { res.status(404).json({ error: "No data found." }); }
            } catch (err) {
                console.error("API Error:", err);
                res.status(500).json({ error: "Internal server error" });
            }
        });

        // --- NEW API ENDPOINT FOR RECENT DATA ---
        app.get('/api/recent', async (req, res) => {
            console.log("API request received for /api/recent");
            try {
                // Find the last 20 documents, sorted by newest first
                const recentData = await collection.find({}).sort({ timestamp: -1 }).limit(20).toArray();
                res.json(recentData);
            } catch (err) {
                console.error("API Error fetching recent data:", err);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        // --- END OF NEW API ENDPOINT ---

        // --- MQTT Client Setup ---
        // ... (the rest of your code is unchanged)
        console.log('Connecting to MQTT broker...');
        const mqttClient = mqtt.connect(MQTT_BROKER);
        mqttClient.on('connect', () => {
            console.log('✅ Connected to MQTT Broker!');
            mqttClient.subscribe(MQTT_TOPIC, (err) => {
                if (!err) {
                    console.log(`📡 Subscribed to topic: ${MQTT_TOPIC}`);
                }
            });
        });
        mqttClient.on('message', async (topic, message) => {
            try {
                const sensorData = JSON.parse(message.toString());
                sensorData.timestamp = new Date();
                const result = await collection.insertOne(sensorData);
                console.log(`💾 Saved data to MongoDB with id: ${result.insertedId}`);
                io.emit('sensor-data', sensorData);
            } catch (err) {
                console.error("❌ Error processing message or saving to DB:", err);
            }
        });
        server.listen(PORT, () => {
            console.log(`🌐 Server is running on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error("🔥 A critical error occurred:", err);
        await mongoClient.close();
    }
}

main().catch(console.error);