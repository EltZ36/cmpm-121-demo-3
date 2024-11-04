// todo
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const alertButton = document.createElement("button");
alertButton.id = "alertButton";
alertButton.innerHTML = "Alert";
alertButton.addEventListener("click", () => {
  alert("you clicked the button!");
});
app.append(alertButton);
