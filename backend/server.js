const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const GroupMessage = require("./models/GroupMessage");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
}));
app.use(bodyParser.json());
app.use(express.static("public"));

mongoose.connect('mongodb+srv://admin:admin123@lab-test-1.8e0wr.mongodb.net/?retryWrites=true&w=majority&appName=lab-test-1', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://127.0.0.1:5500",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("joinRoom", async (data) => {
        const { username, room } = data;
        socket.join(room);

        console.log(`${username} joined room: ${room}`);

        try {
            const messages = await GroupMessage.find({ room }).sort({ date_sent: 1 });
            socket.emit("previousMessages", messages);

            socket.to(room).emit("message", {
                username: "System",
                text: `${username} has joined the room`,
            });
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    });

    socket.on("chatMessage", async (data) => {
        const { username, room, text } = data;

        const newMessage = new GroupMessage({
            from_user: username,
            room: room,
            message: text,
        });

        try {
            await newMessage.save();

            io.to(room).emit("message", {
                username: username,
                text: text,
            });
        } catch (error) {
            console.error("Error saving message to MongoDB:", error);
        }
    });

    socket.on("typing", (data) => {
        socket.to(data.room).emit("typing", { username: data.username });
    });

    socket.on("stopTyping", (data) => {
        socket.to(data.room).emit("stopTyping", { username: data.username });
    });

    socket.on("leaveRoom", (data) => {
        socket.leave(data.room);
        console.log(`${data.username} left room: ${data.room}`);

        socket.to(data.room).emit("message", {
            username: "System",
            text: `${data.username} has left the room`,
        });
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });
});

app.post("/api/signup", async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            password: hashedPassword,
        });

        await newUser.save();
        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        res.status(200).json({ message: "Sign in successful" });
    } catch (error) {
        console.error("Error during signin:", error);
        res.status(500).json({ message: "Server error" });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
