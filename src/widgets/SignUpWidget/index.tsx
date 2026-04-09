import { useState } from "react";
import postUserData from "../../entities/users/api/postUserData";
import { useNavigate } from "react-router-dom";

export interface UserDataProps {
    username: string;
    email: string;
    password: string;
    nickname: string;
}

const SignUpWidget= () => {
    const [userdata, setUserdata] = useState<UserDataProps>({
        username: "",
        email: "",
        password: "",
        nickname: "",
    });
    const navigate = useNavigate();
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleSignUp = () => {
        if (userdata.password !== confirmPassword) {
            alert("비밀번호가 일치하지 않습니다. 다시 확인해주세요.");
            return;
        } else {
            // Here you would typically send the data to your backend for processing
            postUserData(userdata);
            alert("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.");
            navigate("/login");

        }

    }

    return (
        <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-lg">
            <div className="flex-1 p-2 m-2 bg-white text-black border-b border-gray-300 rounded-xl">
                <input type="text" placeholder="Username" onChange={(e) => setUserdata({...userdata, username: e.target.value})}/>
            </div>
            <div className="flex-1 p-2 m-2 bg-white text-black border-b border-gray-300 rounded-xl">
                <input type="text" placeholder="Nickname" onChange={(e) => setUserdata({...userdata, nickname: e.target.value})}/>
            </div>
            <div className="flex-1 p-2 m-2 bg-white text-black border-b border-gray-300 rounded-xl">
                <input type="text" placeholder="Email" onChange={(e) => setUserdata({...userdata, email: e.target.value})}/>
            </div>
            <div className="flex-1 p-2 m-2 bg-white text-black border-b border-gray-300 rounded-xl">
                <input type="password" placeholder="Password" onChange={(e) => setUserdata({...userdata, password: e.target.value})}/>
            </div>
            <div className="flex-1 p-2 m-2 bg-white text-black border-b border-gray-300 rounded-xl">
                <input type="password" placeholder="Confirm Password" onChange={(e) => setConfirmPassword(e.target.value)}/>
            </div>
            
            <button 
                className="flex-1 p-2 m-2 bg-amber-100 text-stone-700 border font-medium border-amber-100 hover:bg-amber-200 rounded-xl"
                onClick={handleSignUp}
            >
                Sign Up
            </button>
        </div>
    );
}

export default SignUpWidget;