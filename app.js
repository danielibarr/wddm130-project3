// app.js

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { body, validationResult } = require("express-validator");

const Notice = require("./models/Notice");
const Admin = require("./models/Admin");

require("dotenv").config();

const app = express();

const PORT = 3000;


// CONFIGURATION

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");


// MIDDLEWARE

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "noticehub-secret",
    resave: false,
    saveUninitialized: false
}));

app.use(function(req, res, next) {

    res.locals.admin = req.session.admin;

    next();
});


// MONGODB CONNECTION
mongoose.connect(process.env.MONGODB_URI)
    .then(function() {
        console.log("Connected to MongoDB");
    })
    .catch(function(error) {
        console.log("MongoDB connection error:", error);
    });


// Authentication middleware

function isAuthenticated(req, res, next) {

    if (!req.session.admin) {
        return res.redirect("/login");
    }

    next();
}


// ROUTES


// HOME

app.get("/", async function(req, res) {

    const notices = await Notice.find().sort({ createdAt: -1 });

    res.render("index", {
        notices: notices
    });

});


// LOGIN - GET

app.get("/login", function(req, res) {

    res.render("login");

});


// LOGIN - POST

app.post(
    "/login",

    body("username")
        .trim()
        .notEmpty()
        .withMessage("Username is required"),

    body("password")
        .notEmpty()
        .withMessage("Password is required"),

    async function(req, res) {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.send(errors.array());
        }

        const username = req.body.username;
        const password = req.body.password;

        const admin = await Admin.findOne({
            username: username,
            password: password
        });

        if (!admin) {
            return res.send("Invalid username or password");
        }

        req.session.admin = {
            id: admin._id,
            username: admin.username,
            displayName: admin.displayName
        };

        res.redirect("/admin");

    }
);


// LOGOUT

app.get("/logout", function(req, res) {

    req.session.destroy(function(error) {

        if (error) {
            return res.send("Error logging out");
        }

        res.redirect("/login");

    });

});


// ADMIN DASHBOARD

app.get("/admin", isAuthenticated, async function(req, res) {

    const notices = await Notice.find().sort({ createdAt: -1 });

    res.render("admin", {
        admin: req.session.admin,
        notices: notices
    });

});


// ADD NOTICE - GET

app.get("/admin/notices/add", isAuthenticated, function(req, res) {

    res.render("add-notice", {
        errors: []
    });

});


// ADD NOTICE - POST

app.post(
    "/admin/notices/add",
    isAuthenticated,

    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ max: 100 })
        .withMessage("Title must be 100 characters or less"),

    body("message")
        .trim()
        .notEmpty()
        .withMessage("Message is required")
        .isLength({ max: 500 })
        .withMessage("Message must be 500 characters or less"),

    async function(req, res) {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {

            return res.render("add-notice", {
                errors: errors.array()
            });

        }

        const title = req.body.title;
        const message = req.body.message;

        await Notice.create({
            title: title,
            message: message
        });

        res.redirect("/");

    }
);


// DELETE NOTICE

app.post(
    "/admin/notices/delete/:id",
    isAuthenticated,
    async function(req, res) {

        await Notice.findByIdAndDelete(req.params.id);

        res.redirect("/admin");

    }
);


// SERVER

if (process.env.NODE_ENV !== "production") {

    app.listen(PORT, function() {

        console.log(`Server running on http://localhost:${PORT}`);

    });

}

module.exports = app;