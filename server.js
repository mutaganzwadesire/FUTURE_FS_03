// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const shortid = require("shortid");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/urlShortener");

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model("User", userSchema);

// URL Schema
const urlSchema = new mongoose.Schema({
  shortId: String,
  originalUrl: String,
  clicks: { type: Number, default: 0 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const URL = mongoose.model("URL", urlSchema);

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, "secretKey", (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// User Registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();
  res.status(201).json({ message: "User registered successfully" });
});

// User Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found" });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ userId: user._id }, "secretKey");
  res.json({ token });
});

// Shorten URL endpoint
app.post("/shorten", authenticateToken, async (req, res) => {
  const { originalUrl } = req.body;
  const shortId = shortid.generate();
  const newUrl = new URL({ shortId, originalUrl, userId: req.user.userId });
  await newUrl.save();
  res.json({ shortUrl: `http://localhost:5000/${shortId}` });
});

// Redirect to original URL
app.get("/:shortId", async (req, res) => {
  const { shortId } = req.params;
  const urlEntry = await URL.findOne({ shortId });
  if (urlEntry) {
    urlEntry.clicks++;
    await urlEntry.save();
    res.redirect(urlEntry.originalUrl);
  } else {
    res.status(404).json({ error: "URL not found" });
  }
});

// Get URL stats
app.get("/stats/:shortId", authenticateToken, async (req, res) => {
  const { shortId } = req.params;
  const urlEntry = await URL.findOne({ shortId, userId: req.user.userId });
  if (urlEntry) {
    res.json({ originalUrl: urlEntry.originalUrl, clicks: urlEntry.clicks });
  } else {
    res.status(404).json({ error: "URL not found" });
  }
});

// Get all URLs for a user
app.get("/user/urls", authenticateToken, async (req, res) => {
  const urls = await URL.find({ userId: req.user.userId });
  res.json(urls);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));