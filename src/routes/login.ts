import express, { Request, Response, NextFunction } from "express";
import { body, matchedData, validationResult } from "express-validator";
import cookieParser from "cookie-parser";
import { verifyPasswordAndCreateJWT, verifyJWT } from "../services/JWTService";
import { login } from "../services/AuthenticationService";
import { optionalAuthentication } from "./Authentication";

export const loginRouter = express.Router();

// Middleware zur Verarbeitung von Cookies
loginRouter.use(cookieParser());

// Konfiguration
const COOKIE_NAME = "access_token";
const TTL = parseInt(process.env.JWT_TTL || "3600", 10); // Standard: 1 Stunde

/**
 * POST /api/login
 * Route zum Einloggen eines Benutzers.
 */
loginRouter.post(
    "/",
    body("name").isString().isLength({ max: 100 }),
    body("password").isString().isLength({ min: 3, max: 100 }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Validierung der Eingabe
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ errors: errors.array() });
          return; 
        }
  
        const { name, password } = matchedData(req) as { name: string; password: string };
        const loginResult = await login(name, password);
  
        if (!loginResult) {
          res.status(401).json({ message: "Login fehlgeschlagen" });
          return; // Funktion beenden
        }
  
        // JWT erstellen
        const jwtString = await verifyPasswordAndCreateJWT(name, password);
        if (!jwtString) {
          throw new Error("Fehler beim Erstellen des JWT");
        }
  
        // JWT im Cookie speichern
        res.cookie(COOKIE_NAME, jwtString, {
          httpOnly: true,
          expires: new Date(Date.now() + TTL * 1000), // Ablaufzeit des Cookies
          secure: true, // Nur für HTTPS
          sameSite: "none",
        });
  
        // Benutzerinformationen zurückgeben
        res.status(201).json({
          id: loginResult.id,
          exp: Math.floor(Date.now() / 1000) + TTL, // Ablaufzeit als Unix-Timestamp
        });
      } catch (err) {
        next(err); // Fehler weitergeben
      }
    }
  );
  

/**
 * GET /api/login
 * Überprüft, ob der Benutzer eingeloggt ist.
 */
loginRouter.get("/", async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.cookies[COOKIE_NAME];
  
      if (!token) {
        res.status(200).send(false); // Kein Token vorhanden
        return;
      }
  
      const decoded = verifyJWT(token);
  
      // Erfolgreiche Überprüfung des Tokens
      res.status(200).json({
        id: decoded.id,
        exp: decoded.exp,
      });
    } catch (err) {
      console.error("Fehler bei der Überprüfung des Tokens:", err);
  
      // Lösche das Cookie bei fehlerhafter Authentifizierung
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
  
      res.status(200).send(false); // Fehlgeschlagene Authentifizierung
    }
  });
  

/**
 * DELETE /api/login
 * Loggt den Benutzer aus, indem das Cookie gelöscht wird.
 */
loginRouter.delete("/", (req: Request, res: Response) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.status(204).send();
  } catch (err) {
    console.error("Fehler beim Logout:", err);
    res.status(500).json({ error: "Fehler beim Logout" });
  }
});

