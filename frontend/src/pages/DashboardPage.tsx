import Navbar from '../components/Navbar'

const DashboardPage = () => {
  return (
    <div>
      <Navbar />
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Welcome to FlowGenie Dashboard!</h2>
        <p>You are logged in 🎉</p>
      </div>
    </div>
  )
}

export default DashboardPage
