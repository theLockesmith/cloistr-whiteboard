import { AuthProvider } from './auth/AuthContext'
import Whiteboard from './components/Whiteboard'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Whiteboard />
      </div>
    </AuthProvider>
  )
}

export default App