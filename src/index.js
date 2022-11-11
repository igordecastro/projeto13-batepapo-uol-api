import express from "express";
import { MongoClient } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const schemaParticipant = Joi.object({
  name: Joi.string().required(),
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("batePapoUol");
} catch (err) {
  console.log(err);
}

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find({}).toArray();

    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  try {
    const messages = await db.collection("messages").find({}).toArray();
    res.send(messages);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/participants", async (req, res) => {
  const participant = req.body;
  const { error } = schemaParticipant.validate(participant, {
    abortEarly: false,
  });
  
  await db.collection("participants").insertOne({
    name: req.body.name,
    lastStatus: Date.now(),
  });

  if (error) {
    const erros = error.details.map((detail) => detail.message);
    res.status(422).send(erros);
    return;
  }

  db.collection("messages").insertOne({
    from: req.body.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("hh:mm:ss"),
  });
  res.sendStatus(201);
});

app.listen(5000, () => console.log("Running in port 5000"));
