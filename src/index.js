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

const schemaMessage = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().required().valid("message").valid("private_message"),
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
let participants;

try {
  await mongoClient.connect();
  db = mongoClient.db("batePapoUol");
  participants = await db.collection("participants").find({}).toArray();
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
  const user = req.headers.user;
  const limit = parseInt(req.query.limit);

  try {
    const messages = await db
      .collection("messages")
      .find({ $or: [{ type: "message" }, { to: user }, { to: "Todos" }] })
      .toArray();
    if (limit) {
      return res.send(messages.slice(-limit));
    } else {
      return res.send(messages);
    }
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
  const participantAlreadyExists = await db
    .collection("participants")
    .findOne({ name: participant.name });

  if (error) {
    const erros = error.details.map((detail) => detail.message);
    res.status(422).send(erros);
    return;
  }

  if (participantAlreadyExists) {
    return res.sendStatus(409);
  }

  await db.collection("participants").insertOne({
    name: participant.name,
    lastStatus: Date.now(),
  });
  db.collection("messages").insertOne({
    from: participant.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("hh:mm:ss"),
  });

  res.sendStatus(201);
});

app.post("/messages", async (req, res) => {
  const message = req.body;
  const user = req.headers.user;
  const { error } = schemaMessage.validate(message, {
    abortEarly: false,
  });
  const userExists = await db
    .collection("participants")
    .findOne({ name: user });

  if (!userExists) {
    res.sendStatus(422);
    return;
  }
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  await db.collection("messages").insertOne({
    ...message,
    from: user,
    time: dayjs().format("hh:mm:ss"),
  });
  res.sendStatus(201);
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  const userExists = await db
    .collection("participants")
    .findOne({ name: user });

  if (!userExists) {
    return res.sendStatus(404);
  } else {
    await db.collection("participants").updateOne(
      {
        name: userExists.name,
      },
      { $set: { ...userExists, lastStatus: Date.now() } }
    );
  }
  res.sendStatus(200);
});

async function removeInactiveUsers() {
  participants = await db.collection("participants").find({}).toArray();
  participants.length !== 0 &&
    participants.forEach(async (participant) => {
      const now = Date.now()
      if (now >= (participant.lastStatus + 10000));
      {
         await db
          .collection("participants")
          .deleteOne({ name: participant.name });
         await db.collection("messages").insertOne({
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("hh:mm:ss"),
        });
      }
    });
}

setInterval(removeInactiveUsers, 15 * 1000);

app.listen(5000, () => console.log("Running in port 5000"));
