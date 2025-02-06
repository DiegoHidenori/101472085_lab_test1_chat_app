const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend requests
app.use(bodyParser.json());
app.use(express.static("public")); // Serve static files

// MongoDB connection
mongoose.connect('mongodb+srv://admin:admin123@lab-test-1.8e0wr.mongodb.net/?retryWrites=true&w=majority&appName=lab-test-1', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
      origin: "http://127.0.0.1:5500", // or "http://localhost:5500" if using localhost
      methods: ["GET", "POST"]
    }
  });   
app.use(cors());

// Socket.io connection handling
io.on("connection", (socket) => {
    console.log("A user connected");

    // Join Room Event
    socket.on("joinRoom", (data) => {
        socket.join(data.room);
        console.log(`${data.username} joined room: ${data.room}`);

        // Notify other users in the room
        socket.to(data.room).emit("message", {
            username: "System",
            text: `${data.username} has joined the room`,
        });
    });

    // Chat Message Event
    socket.on("chatMessage", (data) => {
        socket.to(data.room).emit("message", {
            username: data.username,
            text: data.text,
        });
    });

    // Typing Event
    socket.on("typing", (data) => {
        socket.to(data.room).emit("typing", { username: data.username });
    });

    // Stop Typing Event
    socket.on("stopTyping", (data) => {
        socket.to(data.room).emit("stopTyping", { username: data.username });
    });

    // Leave Room Event
    socket.on("leaveRoom", (data) => {
        socket.leave(data.room);
        console.log(`${data.username} left room: ${data.room}`);

        // Notify other users in the room
        socket.to(data.room).emit("message", {
            username: "System",
            text: `${data.username} has left the room`,
        });
    });

    // Disconnect Event
    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });
});

// Signup Route
app.post("/api/signup", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Username already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        res.json({ success: true, message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Login Route
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        // Send response with success
        res.json({ success: true, message: "Login successful", username: user.username });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
