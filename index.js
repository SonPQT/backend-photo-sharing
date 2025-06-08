require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const dbConnect = require("./db/dbConnect");
const path = require("path");
const cookieParser = require("cookie-parser");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;
global.JWT_SECRET = JWT_SECRET;

dbConnect();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  })
);

app.use(cookieParser());

const imagesPath = path.join(__dirname, "images");
app.use("/images", express.static(imagesPath));

app.use(express.json());
app.use("/api/user", UserRouter);
app.use("/api/photo", PhotoRouter);

app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

app.listen(8081, () => {
  console.log("server listening on port 8081");
});
