import './styles.css';
import { App } from './App';

const container = document.getElementById('app');
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;

if (!container) throw new Error('No #app element found');
if (!hudCanvas) throw new Error('No #hud canvas found');

const app = new App(container, hudCanvas);
app.start();
