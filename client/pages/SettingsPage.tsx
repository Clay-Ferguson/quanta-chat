import { useState, useEffect, useRef } from 'react';
import { app } from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faUpload, faUser } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { useGlobalState } from '../GlobalState';
import TitledPanelComp from '../components/TitledPanelComp';
import { util } from '../Util';
import HexKeyComp from '../components/HexKeyComp';
import { PanelKeys } from '../AppServiceTypes';
import { PageNames } from '../AppServiceTypes';
import { alertModal } from '../components/AlertModalComp';
import { confirmModal } from '../components/ConfirmModalComp';
import { idb } from '../IndexedDB';
import appUsers from '../AppUsers';

declare const DESKTOP_MODE: boolean;

async function clear() {
    await idb.clear();
    console.log("Cleared IndexedDB");
    // refresh browser page is the cleanest way to restart from scratch
    window.location.reload();
}

/**
 * Page for managing user settings, including username, avatar, and identity keys.
 * It also provides options for syncing messages with the server and managing storage space.
 * The page allows users to preview their profile, save changes, and wipe all data if necessary.
 */
export default function SettingsPage() {
    const gs = useGlobalState();
    useEffect(() => util.resizeEffect(), []);
    
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [userName, setUserName] = useState('');
    const [userDescription, setUserDescription] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [storageInfo, setStorageInfo] = useState({
        usagePercentage: 0,
        quota: 0,
        usage: 0,
        remainingStorage: 0
    });
    
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const fetchStorageInfo = async () => {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate: any = await navigator.storage.estimate();
                const remainingStorage = estimate.quota - estimate.usage;
                const usagePercentage = (estimate.usage / estimate.quota) * 100;
                
                setStorageInfo({
                    usagePercentage,
                    quota: estimate.quota,
                    usage: estimate.usage,
                    remainingStorage
                });
                
                console.log(`Storage: (${Math.round(usagePercentage)}% used). Quota: ${util.formatStorageSize(estimate.quota)}`);
            }
        };
        
        fetchStorageInfo();
    }, []);

    useEffect(() => {
        // Initialize the userName from global state when component mounts
        if (gs.userProfile!.name) {
            setUserName(gs.userProfile!.name);
        }
        
        // Initialize userDescription from global state
        if (gs.userProfile!.description) {
            setUserDescription(gs.userProfile!.description);
        }
        
        // Initialize avatar preview if available
        if (gs.userProfile!.avatar) {
            setAvatarPreview(gs.userProfile!.avatar.data);
        }        
    }, 
    [gs.userProfile]);

    const togglePrivateKey = () => {
        setShowPrivateKey(!showPrivateKey);
    };
    
    const handleAvatarSelect = () => {
        if (avatarInputRef.current) {
            avatarInputRef.current.click();
        }
    };
    
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            // Only accept image files
            if (!file.type.startsWith('image/')) {
                await alertModal('Please select an image file for your avatar');
                return;
            }
            
            setAvatarFile(file);
            const previewUrl = URL.createObjectURL(file);
            setAvatarPreview(previewUrl);
        }
    };
    
    const previewUserInfo = async () => {
        await saveUserInfo(false);
        appUsers.showUserProfile(gs.keyPair!.publicKey);
    };

    const saveUserInfo = async (showConfirm: boolean) => {
        let userAvatar = null;

        if (avatarFile) {
            // User selected a new file, convert it
            userAvatar = await util.fileToBase64(avatarFile);
        
            // Clean up the object URL
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
            }
        } else if (gs.userProfile!.avatar) {
            // Create a new clean object with just the base properties
            userAvatar = gs.userProfile!.avatar
        }

        const success = await appUsers.saveUserInfo(gs, userName, userDescription, userAvatar);
        if (success && showConfirm) {
            await alertModal("Profile information saved successfully!");
        }
    };

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Settings"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                {!gs.userProfile!.name && ( 
                    <div className="mb-6 p-5 bg-blue-500/20 border-l-4 border-blue-500 rounded-md">
                        <p className="text-lg text-gray-200">
                            Enter a User Name below to get started. No password is required. We use a Public Cryptographic Key to identify you.
                        </p>
                    </div>
                )} 
                
                <div className="space-y-6 max-w-2xl mx-auto">
                    <TitledPanelComp title="About You" collapsibleKey={PanelKeys.settings_userInfo}>
                        <div className="flex flex-col md:flex-row gap-6 mb-4">
                            {/* Avatar section */}
                            <div className="flex flex-col items-center">
                                <div className="mb-3 w-36 h-36 relative">
                                    {avatarPreview ? (
                                        <img 
                                            src={avatarPreview} 
                                            alt="Your avatar" 
                                            className="w-36 h-36 object-cover rounded-full border-2 border-blue-400/30"
                                        />
                                    ) : (
                                        <div className="w-36 h-36 flex items-center justify-center bg-gray-800 rounded-full border-2 border-blue-400/30 text-gray-400">
                                            <FontAwesomeIcon icon={faUser} className="h-16 w-16" />
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={handleAvatarSelect}
                                        className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg"
                                        title="Upload new avatar"
                                    >
                                        <FontAwesomeIcon icon={faUpload} className="h-4 w-4" />
                                    </button>
                                    
                                    {/* Hidden file input */}
                                    <input 
                                        type="file"
                                        ref={avatarInputRef}
                                        onChange={handleAvatarChange}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400">Click to upload an avatar</span>
                            </div>
                            
                            {/* User details section */}
                            <div className="flex-1">
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
                                        placeholder="Enter your User Name"
                                    />
                                </div>
                                
                                <div className="mb-4">
                                    <label htmlFor="userDescription" className="block text-sm font-medium text-blue-300 mb-2">
                                        About Me
                                    </label>
                                    <textarea
                                        id="userDescription"
                                        name="userDescription"
                                        value={userDescription}
                                        onChange={(e) => setUserDescription(e.target.value)}
                                        rows={4}
                                        className="w-full bg-gray-900 border border-blue-400/20 rounded-md py-2 px-3 
                                                text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                        placeholder="Tell others about yourself..."
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            {!DESKTOP_MODE && <button 
                                className="btn-primary mr-2"
                                onClick={previewUserInfo}
                            >
                                Preview
                            </button>}
                            <button 
                                className="btn-primary"
                                onClick={() => saveUserInfo(true)}
                            >
                                Save
                            </button>
                        </div>
                    </TitledPanelComp>

                    {util.getPluginComponentsWrapped('getSettingsPageComponent', 'settings')}

                    <TitledPanelComp title="Identity Keys" collapsibleKey={PanelKeys.settings_identityKeys}>
                        
                        {/* Public Key Section */}
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <p>
                                Your identity keys are used to identify you on the network, because user names are not guaranteed to be unique. Your public key is unique 
                                and will be visible to others, to represent your identity. Your private key must be kept secret like a password.
                            </p>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-blue-300">Public Key</h4>
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Shareable</span>
                            </div>
                            <div className="bg-gray-900 p-3 rounded border border-blue-400/20">
                                <HexKeyComp hexKey={gs.keyPair?.publicKey || ""} />
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
                                    <HexKeyComp hexKey={gs.keyPair?.privateKey || ""} />
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
                                <button className="btn-primary" onClick={() => appUsers.createIdentity(true)}>Create New Keys</button>
                                <button className="btn-primary" onClick={appUsers.importKeyPair}>Import Keys</button>
                            </div>
                        </div>
                    </TitledPanelComp>

                    <TitledPanelComp title="Storage Space" collapsibleKey={PanelKeys.settings_storageSpace}>
                        <div className="text-sm space-y-1">
                            <p className="flex items-center">
                                <span>Usage: </span>
                                <span className="text-lg font-bold ml-1">{Math.round(storageInfo.usagePercentage)}%</span>
                            </p>
                            <p>Total Space: {util.formatStorageSize(storageInfo.quota)}</p>
                            <p>Used Space: {util.formatStorageSize(storageInfo.usage)}</p>
                            <p>Remaining: {util.formatStorageSize(storageInfo.remainingStorage)}</p>
                        </div>
                    </TitledPanelComp>

                    <TitledPanelComp title="Danger Zone" collapsibleKey={PanelKeys.settings_dangerZone}>
                        <div className="bg-gray-800 rounded-lg p-4 border border-red-400/20 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-red-300">Wipe All Data</h4>
                            </div>
                            <p className="text-sm text-gray-300 mb-4">
                                This will permanently delete all your chat data, contacts, and identity keys.
                            </p>
                            <button 
                                className="btn-danger"
                                onClick={async () => {
                                    if (await confirmModal("WARNING: This will completely wipe all your data including chat history, contacts, and identity keys. Are you sure?")) {
                                        clear();
                                    }
                                }}
                            >
                                Wipe All Data
                            </button>
                        </div>
                    </TitledPanelComp>

                    {gs.devMode && <TitledPanelComp title="Diagnostics" collapsibleKey={PanelKeys.settings_Diagnostics}>
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-blue-300">System Logs</h4>
                            </div>
                            <p className="text-sm text-gray-300 mb-4">
                                View system logs for troubleshooting and diagnostic purposes.
                            </p>
                            <button 
                                className="btn-primary"
                                onClick={() => app.goToPage(PageNames.logViewer)}
                            >
                                View Logs
                            </button>
                        </div>
                    </TitledPanelComp>}
                </div>
            </div>
        </div>
    );
}
