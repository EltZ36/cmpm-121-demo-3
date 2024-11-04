// todo
import "./style.css";

const APPLICATION_NAME = "Geocoin Carrier";
const app = document.querySelector<HTMLDivElement>("#app")!;
document.title = APPLICATION_NAME;

const alertButton = document.createElement("button");
alertButton.id = "alertButton";
alertButton.innerHTML = "Alert";
alertButton.addEventListener("click", () => {
  alert("you clicked the button!");
});
app.append(alertButton);
