import { useEffect } from 'react';
import FooterComp from '../components/FooterComp';
import HeaderComp from '../components/HeaderComp';
import ImageViewerComp from '../components/ImageViewerComp';
import MessagesComp from '../components/MessagesComp';
import { useGlobalState } from '../GlobalState';
import { util } from '../Util';

/**
 * Main chat page for the Quanta Chat application. This page displays the chat messages and handles user interactions.
 * It also includes a header and footer for navigation and additional features.
 */
export default function QuantaChatPage() {
    const gs = useGlobalState();
    let mainComp = null;
    
    // Fix for mobile viewport issues
    useEffect(() => util.resizeEffect(), []);

    // Show not connected message if user is not connected
    if (!gs.connected) {
        if (!gs.appInitialized || gs.connecting) {
            mainComp = null;
        }
        else {
            mainComp = (
                <main className="flex-grow overflow-y-auto p-4 bg-gray-900 flex items-center justify-center">
                    <div className="text-center p-8 bg-gray-800 rounded-lg shadow-lg max-w-md">
                        <h2 className="text-2xl font-bold text-blue-400 mb-4">Not Connected</h2>
                        <p className="text-gray-300 mb-2">Enter a room name in the field above and click "Join" to get started chatting.</p>
                    </div>
                </main>
            );
        }
    }
    else {
        mainComp = (
            <MessagesComp id="chatLog" tag="main" messages={gs.messages}/>
        )
    }

    // #QuantaChatPageLayout 
    return (
        <div className="page-container pt-safe">
            <HeaderComp/>
            {mainComp}
            <FooterComp/>
            <ImageViewerComp />
        </div>
    );
}
