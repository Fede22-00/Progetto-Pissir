
var goToUser = document.getElementById("goToUserPageButton");

// Aggiungi un listener per il clic
goToUser.addEventListener("click", function() {
    window.location.href = '/user';
});

var goToAdmin = document.getElementById("goToAdminPageButton");

// Aggiungi un listener per il clic
goToAdmin.addEventListener("click", function() {
    window.location.href = '/admin';
});