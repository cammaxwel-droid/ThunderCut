import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';

const root = document.getElementById('root');

if (!root) throw new Error('Thunder Cut could not find its desktop render target.');

createRoot(root).render(<Home />);
