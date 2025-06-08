const express = require("express");
const Photo = require("../db/photoModel");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const User = require("../db/userModel");
const mongoose = require("mongoose");
const {request,response} = require("express");
const jwt = require('jsonwebtoken');
const fs = require('fs');

function requireAuth(request, response, next){
    const token = request.cookies.jwt;
    if (!token) {
        return response.status(401).json({error: "Unauthorized - No token"});
    }

    try {
        const decoded = jwt.verify(token, global.JWT_SECRET);
        request.userID = decoded.userID;
        next();
    } catch (error) {
        return response.status(401).json({error: "Unauthorized - Invalid token"});
    }
}

const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,"images")
    },
    filename:(req,file,cb)=>{
        const ex = path.extname(file.originalname);
        const filename = Date.now() + '-' + Math.round(Math.random()*1E9) +ex;
        cb(null,filename);
    }
});
const upload = multer({storage: storage});

router.post("/new", requireAuth, upload.single("photo"), async(request, response) => {
    if(!request.file){
        return response.status(400).json({error: "No image provided"});
    }
    try{
        const photo = new Photo({
            user_id: request.userID,
            file_name: request.file.filename,
            date_time: new Date(),
            comments: [],
        });
        await photo.save();
        return response.status(200).json({message: "Photo uploaded successfully"});
    }catch(error){
        console.log("error in photo post: ", error);
        return response.status(500).json({error: "Internal server error"});
    }
});

router.get("/photoOfUser/:id", requireAuth, async(request, response) => {
    try{
        const id = request.params.id;
        const photos = await Photo.find({user_id:id})
            .populate({
                path: 'comments.user_id',
                select: 'first_name last_name'
            })
            .lean()
            .exec();

        const photoComments = photos.map(photo => ({
            _id: photo._id,
            file_name: photo.file_name,
            date_time: photo.date_time,
            user_id: photo.user_id,
            comments: photo.comments.map(comment => ({
                _id: comment._id,
                comment: comment.comment,
                date_time: comment.date_time,
                user: comment.user_id // user_id đã được populate với first_name và last_name
            }))
        }));

        return response.status(200).json(photoComments);
    }catch(error){
        console.log(error);
        return response.status(500).json({error: "Internal server error"})
    }
});

router.post("/commentOfPhoto/:photo_id", requireAuth, async(request, response) => {
    try {
        const photoID = request.params.photo_id;
        const userID = request.userID;
        const {comment} = request.body;

        if(!comment || !comment.trim()){
            return response.status(400).json({error:"Empty comment"});
        }

        const photo = await Photo.findById(photoID);
        if (!photo) {
            return response.status(404).json({error: "Photo not found"});
        }

        const newComment = {
            comment: comment,
            date_time: new Date(),
            user_id: userID,
        };

        photo.comments = photo.comments || [];
        photo.comments.push(newComment);
        await photo.save();

        return response.status(200).json({message:"Comment added successfully"});
    } catch(err) {
        console.log("Error adding comment:", err);
        return response.status(500).json({error: "Internal server error"});
    }
});

router.delete("/delete/:photo_id", requireAuth, async(request, response) => {
    const photo_id = request.params.photo_id;
    
    try {
        // Kiểm tra photo có tồn tại không
        const photo = await Photo.findById(photo_id);
        if (!photo) {
            return response.status(404).json({ error: "Photo not found" });
        }

        // Kiểm tra người dùng có quyền xóa ảnh này không
        if (photo.user_id.toString() !== request.userID) {
            return response.status(403).json({ error: "Unauthorized - You can only delete your own photos" });
        }

        // Xóa file ảnh từ thư mục
        const imagePath = path.join(__dirname, '..', 'images', photo.file_name);
        fs.unlink(imagePath, async (err) => {
            if (err && err.code !== 'ENOENT') { // ENOENT = file không tồn tại
                console.error("Error deleting image file:", err);
                return response.status(500).json({ error: "Error deleting image file" });
            }

            // Xóa thông tin ảnh từ database
            await Photo.findByIdAndDelete(photo_id);
            
            return response.status(200).json({ message: "Photo deleted successfully" });
        });
    } catch (err) {
        console.error("Error deleting photo:", err);
        return response.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
