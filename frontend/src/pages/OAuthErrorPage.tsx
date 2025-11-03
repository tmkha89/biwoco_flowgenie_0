import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const OAuthErrorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-md w-80 text-center">
        <h2 className="text-2xl font-semibold mb-4 text-red-600">OAuth Error</h2>
        <p className="text-gray-700 mb-4">
          {error || 'Authentication failed. Please try again.'}
        </p>
        <p className="text-sm text-gray-500">
          Redirecting to login page...
        </p>
      </div>
    </div>
  );
};

export default OAuthErrorPage;

