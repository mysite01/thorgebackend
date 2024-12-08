import express from "express";
import { createPOI, deletePOI, getAllPOIs, getPOIById } from "../services/POIService";
import { getTeamByPlayerId, updateTeamPOIs } from "../services/TeamService";

export const poiRouter = express.Router();

/**
 * Route für das Erstellen eines neuen POI
 */
poiRouter.post("/", async (req, res, next) => {
    try {
        const newPOI = await createPOI(req.body);
        res.status(201).send(newPOI);
    } catch (err) {
        res.status(400); 
        next(err);
    }
});

/**
 * Route für das Löschen eines POI anhand der ID
 */
poiRouter.delete("/:id", async (req, res, next) => {
    let id = "";
    if (req.params) {
        id = req.params.id;
    }

    try {
        await deletePOI(id);
        res.status(204).send(); 
    } catch (err) {
        res.status(404);
        next(err);
    }
});

/**
 * Route für das Abrufen eines POI anhand der ID
 */
poiRouter.get("/:id", async (req, res, next) => {
    let id = "";
    if (req.params) {
        id = req.params.id;
    }

    try {
        const poi = await getPOIById(id);
        res.status(200).send(poi); 
    } catch (err) {
        res.status(404); 
        next(err);
    }
});

/**
 * Route für das Abrufen aller POIs
 */
poiRouter.get("/", async (req, res, next) => {
    try {
        const pois = await getAllPOIs();
        res.status(200).send(pois); 
    } catch (err) {
        res.status(500); 
        next(err);
    }
});


poiRouter.post("/claim/:id", async (req, res, next) => {
    let id = ""
    let teams
    let player
    if (req.params) {
        id = req.params.id;
    }
    if(req.body) {
        teams = req.body.teamIds;
        player = req.body.playerId;
    }

    try {
        const team = await getTeamByPlayerId(player)
        const teamId = team.id;
        if (!team.poiId.includes(id) && teamId) {
            team.poiId = [...new Set([...team.poiId, id])];
            await updateTeamPOIs(teamId, { poiId: team.poiId }); 
        }

        res.status(200).json({ message: "POI claimed successfully", team });
    } catch (err) {
        res.status(404); 
        next(err);
    }
});



export default poiRouter;
