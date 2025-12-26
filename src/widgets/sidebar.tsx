import React from "react";

// Components
import Login from "../pages/login";
import Profile from "../pages/profile";
import MyPage from "../pages/myPage";
import Setting from "../pages/setting";
import CustomService from "../pages/customService";

export default function Sidebar() {

    return (
            <>
                <Login />
                    <Profile />
                    <MyPage />
                    <Setting />
                    <CustomService />
                </>
            );
    } 