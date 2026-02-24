import Header from "../header";
import Sidebar from "./sidebar";
import MainContent from "./mainContent";

const Layout = () => {
    return (
        <div className="layout-container flex flex-row w-full h-screen">
            <Header />
            <Sidebar />
            <MainContent />
        </div>
    );
};

export default Layout;
