import dotenv from 'dotenv';
dotenv.config(); // .env-Datei laden

import http from "http";
import mongoose from 'mongoose';
import app from "./app";

import { GameResource, POIResource } from "src/Resources";
import { Types } from "mongoose";
import * as GameService from "./services/GameService";
import * as POIService from "./services/POIService"
import { WebSocketServer, WebSocket } from 'ws';




import express from 'express';
import cors from 'cors';




const corsOptions = {
  origin: 'https://geo-pick-point.vercel.app', // Ersetze dies mit deiner tatsächlichen Frontend-Domain
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type, Authorization', // Erlaubte Header
  credentials: true, // Falls du Cookies oder Authentifizierung benötigst
};




app.use(cors(corsOptions));


// Reagiere auf Preflight-Anfragen (OPTIONEN-Methoden)
app.options('*', cors(corsOptions));


app.post('*', (req, res, next) => {
  console.log(`POST request from: ${req.get('Origin') || req.ip}`);
  next(); // Weiter mit der nächsten Middleware oder Route
});




async function createExampleGame() {
    const poi1: POIResource = { name: "Alexanderplatz", lat: 52.520008, long: 13.404954, beschreibung: "Ein belebter Platz mit Fernsehturm, Geschäften und urbanem Flair.", punkte: 100}
    const poi2: POIResource = { name: "Brandenburger Tor", lat: 52.516275, long: 13.377704, beschreibung: "Ein ikonisches Monument und Symbol für Geschichte und Einheit.", punkte: 200}
    const poi3: POIResource = { name: "Podsdamer Platz", lat: 52.509290, long: 13.376340, beschreibung: "Ein moderner Knotenpunkt mit Architektur, Kultur und Unterhaltung.", punkte: 100}
    const poi4: POIResource = { name: "Oberbaumbrücke", lat: 52.501834, long: 13.445656, beschreibung: "Eine markante Brücke mit Doppeldeck-Architektur und historischem Charme.", punkte: 100}
    const poi5: POIResource = { name: "Museumsinsel", lat: 52.516260, long: 13.402480, beschreibung: "Ein einzigartiges Kulturensemble mit weltberühmten Museen.", punkte: 100}
    const poi6: POIResource = { name: "Volkspark Friedrichhain", lat: 52.528730, long: 13.442284, beschreibung: "Ein weitläufiger Park mit grünen Wiesen, Hügeln und Entspannungsoasen.", punkte: 50}
    const poi7: POIResource = { name: "Deutsches Technikmuseum", lat: 52.498603, long: 13.378154, beschreibung: "Ein faszinierendes Museum mit historischen Exponaten zu Technik und Ingenieurskunst.", punkte: 50}
    const poi8: POIResource = { name: "Checkpoint Charlie", lat: 52.507530, long: 13.390378, beschreibung: "Ein historischer Grenzpunkt und Symbol des Kalten Krieges.", punkte: 200}
   

    const poi1FullData = await POIService.createPOI(poi1)
    const poi2FullData = await POIService.createPOI(poi2)
    const poi3FullData = await POIService.createPOI(poi3)
    const poi4FullData = await POIService.createPOI(poi4)
    const poi5FullData = await POIService.createPOI(poi5)
    const poi6FullData = await POIService.createPOI(poi6)
    const poi7FullData = await POIService.createPOI(poi7)
    const poi8FullData = await POIService.createPOI(poi8)

    const gameData: GameResource = {
        title: "Berlin Sehenswürdigkeiten",
        beschreibung: "Einige der bekanntesten Sehenswürdigkeiten in Berlin",
        poilId: [
          poi1FullData.id!,
          poi2FullData.id!,
          poi3FullData.id!,
          poi4FullData.id!,
          poi5FullData.id!,
          poi6FullData.id!,
          poi7FullData.id!,
          poi8FullData.id!,
        ],
        maxTeam: 5,
        userId: new Types.ObjectId().toString(),
    };
    await GameService.createGame(gameData)
}

const clients: Set<WebSocket> = new Set();

function broadcast(data: any) {
    const jsonData = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
        }
    });
}

async function setup() {
    console.log("USE_SSL:", process.env.USE_SSL);
    console.log("HTTP_PORT:", process.env.HTTP_PORT);
    console.log("JWT_SECRET:", process.env.JWT_SECRET);

    let mongodURI = "memory"
    if (!mongodURI) {
        console.error(`Cannot start`);
        process.exit(1);
    }

    if (mongodURI === "memory") {
        console.info("Start MongoMemoryServer");
        const MMS = await import('mongodb-memory-server');
        const mongo = await MMS.MongoMemoryServer.create();
        mongodURI = mongo.getUri();
    }

    console.info(`Connecting to MongoDB at ${mongodURI}`);
    await mongoose.connect(mongodURI);

    await createExampleGame();

    const httpPort = process.env.PORT ? parseInt(process.env.PORT) : 3444;
    const httpServer = http.createServer(app);

    const wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws: WebSocket) => {
        console.info("Ein neuer Client hat sich verbunden.");
        clients.add(ws);
      
        ws.on("message", (message) => {
          try {
            console.info(`Nachricht empfangen: ${message}`);
            const data = JSON.parse(message.toString());
            console.info("Parsed message:", data); // Debugging-Ausgabe
      
            if (data.type === "join") {
              console.info(`${data.playerName} ist Team ${data.teamId} beigetreten.`);
              broadcast({
                type: "join",
                playerId: data.playerId,
                playerName: data.playerName,
                teamId: data.teamId,
              });
            } else if (data.type === "leave") {
              console.info(`${data.playerName} hat Team ${data.teamId} verlassen.`);
              broadcast({
                type: "leave",
                playerId: data.playerId,
                playerName: data.playerName,
                teamId: data.teamId,
              });
            } else if (data.type === "loadMap") {
              broadcast({
                type: "loadMap",
                dataGameInstance: data.dataGameInstance,
                teamID: data.teamID
              });
            }else if (data.type === "loadGame") {
              broadcast({
                type: "loadGame",
              });
            }
          } catch (error) {
            console.error("Fehler beim Verarbeiten der Nachricht:", error);
          }
        });
      
        ws.on("close", () => {
          console.info("Ein Client hat die Verbindung geschlossen.");
          clients.delete(ws);
        });
      });
      

    

    function startHttpServer() {
        httpServer.listen(httpPort, () => {
            console.info(`Listening for HTTP at http://localhost:${httpPort}`);
        });
    }

    httpServer.on('error', (err) => {
        if (err instanceof Error && (err as any).code === 'EADDRINUSE') {
            console.error('Address in use, retrying...');
            setTimeout(() => {
                httpServer.close();
                startHttpServer();
            }, 1000);
        } else {
            console.error(`Server error: ${err.message}`);
        }
    });

    startHttpServer();

    process.on('SIGINT', () => {
        console.info('Received SIGINT. Shutting down gracefully...');
        httpServer.close(() => {
            console.info('Server closed.');
            process.exit(0);
        });
    });
}

setup();