import { useState, useEffect } from 'react';
import { app } from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import { useGlobalState } from '../GlobalState';

export default function SettingsPage() {
    const gs = useGlobalState();
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [userName, setUserName] = useState('');
    const [saveToServer, setSaveToServer] = useState(false);
    const [daysOfHistory, setDaysOfHistory] = useState('');

    useEffect(() => {
        // Initialize the userName from global state when component mounts
        if (gs.userName) {
            setUserName(gs.userName);
        }
        
        // Initialize saveToServer from global state
        setSaveToServer(gs.saveToServer || false);
        
        // Initialize daysOfHistory from global state
        if (gs.daysOfHistory !== undefined) {
            setDaysOfHistory(gs.daysOfHistory.toString());
        }
    }, [gs.userName, gs.saveToServer, gs.daysOfHistory]);

    const togglePrivateKey = () => {
        setShowPrivateKey(!showPrivateKey);
    };

    const handleSaveToServerChange = (e: any) => {
        const isChecked = e.target.checked;
        setSaveToServer(isChecked);
        app.setSaveToServer(isChecked);
    };
    
    const handleDaysOfHistoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setDaysOfHistory(value);
    };
    
    const saveDaysOfHistory = () => {
        // Convert to number and save to global state
        const days = parseInt(daysOfHistory);
        if (!isNaN(days) && days >= 0) {
            app.setDaysOfHistory(days);
        } else {
            alert("Please enter a valid number of days (0 or greater)");
        }
    };

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Settings"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
                </div>
            </header>
            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                {!gs.userName && ( 
                    <div className="mb-6 p-5 bg-blue-500/20 border-l-4 border-blue-500 rounded-md">
                        <h2 className="text-2xl font-bold text-blue-300 mb-2">Welcome to Quanta Chat!</h2>
                        <p className="text-lg text-gray-200">
                            Please enter a username below to get started. Your username helps identify you in conversations.
                        </p>
                    </div>
                )} 
                
                <div className="space-y-6 max-w-2xl mx-auto">
                    {/* About You Section */}
                    <div className="border border-blue-400/30 rounded-lg p-4">
                        <h3 className="text-xl font-medium text-blue-400 border-b border-blue-400/30 pb-2 mb-4">About You</h3>
                        
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <div className="mb-4">
                                <label htmlFor="userName" className="block text-sm font-medium text-blue-300 mb-2">
                                    User Name
                                </label>
                                <input
                                    type="text"
                                    id="userName"
                                    name="userName"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="w-full bg-gray-900 border border-blue-400/20 rounded-md py-2 px-3 
                                              text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your username"
                                />
                            </div>
                            
                            <div className="flex justify-end">
                                <button 
                                    className="btn-primary"
                                    onClick={() => {
                                        app.setUserName(userName);
                                        alert("Username saved successfully!");
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Options Section */}
                    <div className="border border-blue-400/30 rounded-lg p-4">
                        <h3 className="text-xl font-medium text-blue-400 border-b border-blue-400/30 pb-2 mb-4">Options</h3>
                        
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label htmlFor="saveToServer" className="text-sm font-medium text-blue-300 cursor-pointer">
                                        Save Messages on Server
                                    </label>
                                    <p className="text-xs text-gray-400 mt-1">
                                        When enabled, your messages will be stored on the server. Otherwise, messages are only kept locally.
                                    </p>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="saveToServer"
                                        name="saveToServer"
                                        checked={saveToServer}
                                        onChange={handleSaveToServerChange}
                                        className="h-5 w-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                    />
                                </div>
                            </div>
                            
                            {/* Days of History Option */}
                            <div className="mt-4 pt-4 border-t border-blue-400/20">
                                <div className="mb-2">
                                    <label htmlFor="daysOfHistory" className="text-sm font-medium text-blue-300">
                                        Days of History
                                    </label>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Messages older than this many days will be automatically deleted.
                                    </p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="number"
                                        id="daysOfHistory"
                                        name="daysOfHistory"
                                        value={daysOfHistory}
                                        onChange={handleDaysOfHistoryChange}
                                        min="2"
                                        className="bg-gray-900 border border-blue-400/20 rounded-md py-2 px-3 
                                                  text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter days to keep"
                                    />
                                    <button 
                                        className="btn-primary"
                                        onClick={saveDaysOfHistory}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Identity Keys Section */}
                    <div className="border border-blue-400/30 rounded-lg p-4">
                        <h3 className="text-xl font-medium text-blue-400 border-b border-blue-400/30 pb-2 mb-4">Your Identity Keys</h3>
                        
                        {/* Public Key Section */}
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-blue-300">Public Key</h4>
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Shareable</span>
                            </div>
                            <div className="bg-gray-900 p-3 rounded border border-blue-400/20">
                                <code className="font-mono text-green-400 text-sm block">
                                    {gs.keyPair?.publicKey || "No public key available"}
                                </code>
                            </div>
                        </div>

                        {/* Private Key Section */}
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-blue-300">Private Key</h4>
                                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">Secret</span>
                            </div>
                            <div className="mb-2">
                                <button 
                                    onClick={togglePrivateKey}
                                    className="text-sm px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center"
                                >
                                    <span>{showPrivateKey ? "Hide" : "Show"} Private Key</span>
                                    <span className="h-4 w-4 ml-2" >
                                        {showPrivateKey ? (
                                            <FontAwesomeIcon icon={faEyeSlash} className="h-5 w-5" />
                                        ) : (
                                            <FontAwesomeIcon icon={faEye} className="h-5 w-5" />
                                        )}
                                    </span>
                                </button>
                            </div>
                            <div className="bg-gray-900 p-3 rounded border border-red-400/20">
                                {showPrivateKey ? (
                                    <code className="font-mono text-red-400 text-sm block">
                                        {gs.keyPair?.privateKey || "No private key available"}
                                    </code>
                                ) : (
                                    <div className="text-gray-500 italic text-sm flex items-center justify-center p-2 border-dashed border border-gray-700 rounded">
                                        <FontAwesomeIcon icon={faLock} className="h-5 w-5 mr-2" />
                                        Click "Show Private Key" to reveal
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-red-300 mt-2">
                                Warning: Keep your private key secret. Never share it with anyone.
                            </p>
                        </div>
                        <div className="space-y-3 mt-4">
                            <div className="flex space-x-4">
                                <button className="btn-primary" onClick={() => app._createIdentity(true)}>Create New Keys</button>
                                <button className="btn-primary" onClick={app._importKeyPair}>Import Keys</button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Danger Zone Section */}
                    <div className="border border-red-400/30 rounded-lg p-4">
                        <h3 className="text-xl font-medium text-red-400 border-b border-red-400/30 pb-2 mb-4">Danger Zone</h3>
                        
                        <div className="bg-gray-800 rounded-lg p-4 border border-red-400/20 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-red-300">Wipe All Data</h4>
                            </div>
                            <p className="text-sm text-gray-300 mb-4">
                                This will permanently delete all your chat data, contacts, and identity keys.
                            </p>
                            <button 
                                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors duration-200"
                                onClick={() => {
                                    if (window.confirm("WARNING: This will completely wipe all your data including chat history, contacts, and identity keys. This operation cannot be undone. Are you sure?")) {
                                        app.clear();
                                    }
                                }}
                            >
                                Wipe All Data
                            </button>
                        </div>

                        {gs.roomName && (
                            <div className="bg-gray-800 rounded-lg p-4 border border-red-400/20 shadow-md mt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-lg font-medium text-red-300">Wipe Room '{gs.roomName}' Data</h4>
                                </div>
                                <p className="text-sm text-gray-300 mb-4">
                                    This will permanently delete all messages in the current room, from your device. Other users will still have their messages.
                                </p>
                                <button 
                                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors duration-200"
                                    onClick={() => app._clearMessages()}
                                >
                                    Wipe Room Data
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
