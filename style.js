/* style.css */

/* Custom styles for the fade-in-out animation */
@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  10%, 90% { opacity: 1; }
}

.animate-fade-in-out {
  animation: fadeInOut 3s ease-in-out forwards;
}

/* Ensure font-montserrat is applied globally */
body {
    font-family: 'Montserrat', sans-serif;
}
