import { createContext, useContext, ReactNode } from 'react'

// Temporary auth context until cloistr-collab-common provides one
interface AuthContextType {
  pubkey: string | null
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // TODO: Replace with actual authentication when cloistr-collab-common provides AuthProvider
  const authValue: AuthContextType = {
    pubkey: null,
    isAuthenticated: false,
    login: () => {
      console.log('Login not yet implemented - waiting for cloistr-collab-common')
    },
    logout: () => {
      console.log('Logout not yet implemented - waiting for cloistr-collab-common')
    }
  }

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}