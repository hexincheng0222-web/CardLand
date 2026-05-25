import { CardsPage } from './pages/CardsPage';
import { useGameStore } from './stores/gameStore';
import { StartScreen } from './components/StartScreen';
import { HandSelectionScreen } from './components/HandSelectionScreen';
import { GameScreen } from './components/GameScreen';
import { GameOverScreen } from './components/GameOverScreen';
import './index.css';

function App() {
  const path = window.location.pathname;

  if (path === '/cards') {
    return <CardsPage />;
  }

  const gamePhase = useGameStore((s) => s.gamePhase);

  switch (gamePhase) {
    case 'start':
      return <StartScreen />;
    case 'hand-selection':
      return <HandSelectionScreen />;
    case 'gameover':
      return <GameOverScreen />;
    case 'exploration':
    case 'combat':
    case 'event':
    default:
      return <GameScreen />;
  }
}

export default App;
