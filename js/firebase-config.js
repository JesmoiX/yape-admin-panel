const firebaseConfig = {
    apiKey: "AIzaSyA5O4gFFL4WuAVVEjk6PuvVRg1bOL_n_Jk",
    authDomain: "notificationcapture-b4935.firebaseapp.com",
    databaseURL: "https://notificationcapture-b4935-default-rtdb.firebaseio.com",
    projectId: "notificationcapture-b4935",
    storageBucket: "notificationcapture-b4935.firebasestorage.app",
    messagingSenderId: "576269581874"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized");
} else {
    console.error("Firebase SDK not loaded");
}
