# CoDraw

A collaborative drawing app where users can create canvases, invite teammates, and draw together live.


## Features

 Register and log in with JWT authentication

 Create drawing canvases with a unique join code

 Invite collaborators by email or join code

 Draw together in real time with live cursors

 Leave comments on drawings


## Environment Variables

```
MONGO_URI= MongoDB connection string
PORT= Port the backend server runs on (5000)
JWT_SECRET= Secret key used to sign and verify JWT tokens
```

## Local Setup

### Backend
```
npm install
node src/server.js
```

### Frontend
```
cd frontend
npm install
ng serve
```


The app is deployed on Render:

https://codraw-static.onrender.com

Link to the Video Presentation:

https://drive.google.com/file/d/1u15l4RG-PylkOyqD2tqiNqzJK9_JlGtS/view?usp=sharing


