const express = require("express");
const User = require("../db/userModel");
const router = express.Router();
const { request, response } = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

function requireAuth(request, response, next) {
  const token = request.cookies.jwt;
  if (!token) {
    return response.status(401).json({ error: "Unauthorized - No token" });
  }

  try {
    const decoded = jwt.verify(token, global.JWT_SECRET);
    request.userID = decoded.userID;
    next();
  } catch (error) {
    return response.status(401).json({ error: "Unauthorized - Invalid token" });
  }
}

router.post("/admin/login", async (request, response) => {
  const { login_name, password } = request.body;
  if (!login_name || !password) {
    return response
      .status(400)
      .json({ error: "Missing login_name or password" });
  }
  try {
    const user = await User.findOne({ login_name: login_name });
    if (!user || user.password !== password) {
      return response
        .status(400)
        .json({ error: "Invalid login_name or password" });
    }

    // Tạo JWT token
    const token = jwt.sign({ userID: user._id }, global.JWT_SECRET, {
      expiresIn: "24h",
    });

    console.log("=== JWT TOKEN INFO ===");
    console.log("Token:", token);

    // Lưu token vào cookie
    response.cookie("jwt", token, {
      // httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 giờ
      sameSite: "None",
    });

    console.log("=== COOKIE INFO ===");
    console.log("Cookie sent:", response.getHeader("Set-Cookie"));
    console.log("==================");

    response.status(200).json({
      user: {
        _id: user._id,
        login_name: user.login_name,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    console.log("Error in login: ", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

router.get("/check-auth", requireAuth, async (request, response) => {
  try {
    const user = await User.findById(request.userID);
    if (!user) {
      return response.status(404).json({ error: "User not found" });
    }
    return response.status(200).json({
      _id: user._id,
      login_name: user.login_name,
      first_name: user.first_name,
      last_name: user.last_name,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register", async (request, reponse) => {
  const {
    login_name,
    password,
    first_name,
    last_name,
    location,
    description,
    occupation,
  } = request.body;
  if (!login_name || !password || !first_name || !last_name) {
    return reponse
      .status(400)
      .json({ error: "Missing login name,password,firsts name of last name" });
  }
  try {
    const existingUser = await User.findOne({ login_name: login_name });
    if (existingUser) {
      return reponse.status(400).json({ error: "User already exists" });
    }
    const newUser = new User({
      login_name: login_name,
      password: password,
      first_name: first_name,
      last_name: last_name,
      location: location || "",
      description: description || "",
      occupation: occupation || "",
    });
    console.log(newUser);
    await newUser.save();
    reponse.status(200).json({
      message: "User registered successfully",
      _id: newUser._id,
      login_name: newUser.login_name,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
    });
  } catch (error) {
    console.log("Error in register: ", error);
    return reponse.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/logout", requireAuth, (request, response) => {
  // Xóa JWT cookie
  response.clearCookie("jwt", {
    secure: true,
    sameSite: "None",
  });

  console.log("request.userID", request.userID);
  request.userID = null;
  return response.status(200).json({ message: "Logged out successfully" });
});

router.get("/list", requireAuth, async (request, response) => {
  try {
    const users = await User.find({}, "_id first_name last_name");
    return response.status(200).json(users);
  } catch (error) {
    return response.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (request, response) => {
  const id = request.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return response.status(404).json({ error: "Invalid user ID" });
  }
  try {
    const user = await User.findById(
      id,
      "_id first_name last_name location description occupation"
    );
    if (!user) {
      return response.status(404).json({ error: "User not found" });
    }
    return response.status(200).json(user);
  } catch (error) {
    return response.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
