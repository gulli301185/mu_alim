import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function AppToaster() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4500}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme="colored"
      className="app-toast-container"
      toastClassName="app-toast"
    />
  );
}
