import React from "react";

// Components
import Login from "../app/login";
import Profile from "../app/profile";
import MyPage from "../app/myPage";
import Setting from "../app/setting";
import CustomService from "../app/customService";

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