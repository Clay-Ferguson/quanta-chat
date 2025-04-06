import { useGlobalState, useGlobalDispatch } from './GlobalState';
import { useState, useRef, useEffect } from 'react';
import AppService from './AppService';
const app = AppService.getInst(); 

function QuantaChat() {
    const gs = useGlobalState();
    const dispatch = useGlobalDispatch();

    const [message, setMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Add state for the full-size image viewer
    const [fullSizeImage, setFullSizeImage] = useState<{
        src: string;
        name: string;
    } | null>(null);
    
    // Auto-resize function for textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            // Reset height to auto to get the correct scrollHeight
            textarea.style.height = 'auto';
            // Set new height but cap it with CSS max-height
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [message]);
    
    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
    };
    
    // Local state for form fields
    const [formData, setFormData] = useState({
        userName: gs.userName || '',
        roomName: gs.roomName || ''
    });

    const handleInputChange = (e: any) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const connect = async () => {
        app._connect(dispatch, formData.userName, formData.roomName);
    };

    const disconnect = () => {
        app._disconnect(dispatch);
    };

    const clear = () => {
        if (gs.connected) {
            app._clearMessages(dispatch);
        } else {
            console.log("Not connected, cannot clear messages.");
        }
    };
    
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    
    // Add this utility function to convert file to base64
    // todo-0: this was already in Utils, but AI duplicated it here.
    const fileToBase64 = (file: File): Promise<{
        name: string;
        type: string;
        size: number;
        data: string;
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result as string
            });
            reader.onerror = error => reject(error);
        });
    };

    // Update the toggleFullSize function to handle opening the full-size image viewer
    const toggleFullSize = (src: string, name: string) => {
        setFullSizeImage(fullSizeImage ? null : { src, name });
    };

    // Modify the handleFiles function to convert files to base64
    const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            try {
                const filesArray = Array.from(e.target.files);
                setSelectedFiles(filesArray);
            } catch (error) {
                console.error("Error processing files:", error);
            }
        }
    };

    // Utility function to format file size
    // todo-0: I think I have a Utils method for this already.
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    // Update the send function to convert files to base64 before sending
    const send = async () => {
        if ((!message.trim() && selectedFiles.length === 0) || !gs.connected) {
            console.log("Not connected or empty message with no attachments, not sending.");
            return;
        }
        
        if (selectedFiles.length > 0) {
            try {
                console.log(`Sending message with ${selectedFiles.length} attachments`);
                
                // Convert all files to base64 format
                const processedAttachments = await Promise.all(
                    selectedFiles.map(file => fileToBase64(file))
                );
                
                // Send message with attachments
                app.send(dispatch, message.trim(), processedAttachments, gs);
            } catch (error) {
                console.error("Error processing attachments:", error);
            }
        } else {
            // Send message without attachments
            app.send(dispatch, message.trim(), null, gs);
        }
        
        setMessage(''); // Clear the message input after sending
        setSelectedFiles([]); // Clear the selected files after sending
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const participants = 'Members: ' + Array.from(gs.participants).join(', ');
    
    useEffect(() => {
        // Get URL parameters
        const getUrlParameter = (name: string): string | null => {
            const searchParams = new URLSearchParams(window.location.search);
            return searchParams.get(name);
        };
        
        // Get userName and roomName from URL if they exist
        const userNameParam = getUrlParameter('user');
        const roomNameParam = getUrlParameter('room');
        
        // Update form data if URL parameters exist
        if (userNameParam || roomNameParam) {
            setFormData(prev => ({
                userName: userNameParam || prev.userName,
                roomName: roomNameParam || prev.roomName
            }));
        }
        
        // Auto-connect if both parameters are present
        if (userNameParam && roomNameParam && !gs.connected) {
            // Use a short timeout to ensure state is updated before connecting
            const timer = setTimeout(() => {
                app._connect(dispatch, userNameParam, roomNameParam);
            }, 100);
            
            return () => clearTimeout(timer);
        }
    }, []);  // Empty dependency array means this runs once on component mount

    return (
        <div className="h-screen flex flex-col w-screen min-w-full">
            {/* Hidden file input element */}
            <input 
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFiles}
            />
            
            <header className="w-full bg-blue-500 text-white p-4 flex-shrink-0 flex justify-between items-center">
                <div className="w-1/4">
                    <h1 className="text-xl font-semibold">Quanta Chat</h1>
                    <h2 className="font-semibold">{participants}</h2>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <label htmlFor="userName" className="mr-2">Name:</label>
                        <input 
                            id="userName"
                            type="text" 
                            value={formData.userName} 
                            onChange={handleInputChange}
                            className="rounded px-2 py-1 text-black w-28" 
                        />
                    </div>
                    <div className="flex items-center">
                        <label htmlFor="roomName" className="mr-2">Room:</label>
                        <input 
                            id="roomName"
                            type="text" 
                            value={formData.roomName} 
                            onChange={handleInputChange}
                            className="rounded px-2 py-1 text-black w-28" 
                        />
                    </div>
                    <button 
                        disabled={!formData.userName || !formData.roomName || gs.connected}
                        onClick={connect}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Connect
                    </button>
                    <button 
                        onClick={disconnect}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Disconnect
                    </button>
                    <button 
                        onClick={clear}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Clear
                    </button>
                </div>
            </header>

            <main id="chatLog" className="flex-grow overflow-y-auto p-4">
                <div className="space-y-2 max-w-full">
                    {gs.messages.map((msg, index) => (
                        <div 
                            key={index} 
                            className={`${msg.sender === gs.userName ? 'bg-white' : 'bg-gray-200'} p-3 rounded-md shadow-sm flex flex-col`}
                        >
                            <div className="flex">
                                <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                    <span className="font-semibold text-sm">{msg.sender}</span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(msg.timestamp).toLocaleDateString('en-US', { 
                                            month: '2-digit', 
                                            day: '2-digit', 
                                            year: '2-digit' 
                                        })} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="w-px bg-gray-300 self-stretch mx-2"></div>
                                <div className="flex-1 text-left">
                                    {msg.content}
                                </div>
                            </div>
                            
                            {/* Attachments section */}
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {msg.attachments.map((attachment: any, attIndex) => (
                                            <div key={attIndex} className="attachment-container border rounded p-2 flex flex-col">
                                                {attachment.type.startsWith('image/') ? (
                                                    <>
                                                        {/* Image attachment */}
                                                        <div className="relative">
                                                            <img 
                                                                src={attachment.data}
                                                                alt={attachment.name}
                                                                className="max-w-full rounded cursor-pointer max-h-40 object-contain"
                                                                onClick={() => toggleFullSize(attachment.data, attachment.name)}
                                                                title="Click to view full size"
                                                            />
                                                            <button 
                                                                className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // For base64 data, we can use it directly for download
                                                                    const downloadLink = document.createElement('a');
                                                                    downloadLink.href = attachment.data;
                                                                    downloadLink.download = attachment.name;
                                                                    document.body.appendChild(downloadLink);
                                                                    downloadLink.click();
                                                                    document.body.removeChild(downloadLink);
                                                                }}
                                                                title={`Download ${attachment.name}`}
                                                            >
                                                                ⬇️
                                                            </button>
                                                        </div>
                                                        <div className="text-xs mt-1 truncate">{attachment.name}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* Non-image attachment */}
                                                        <div className="flex items-center">
                                                            <span className="text-2xl mr-2">📄</span>
                                                            <div className="flex-1">
                                                                <div className="font-medium text-sm truncate">{attachment.name}</div>
                                                                <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                                                            </div>
                                                            <button 
                                                                className="bg-blue-500 text-white rounded px-2 py-1 text-sm hover:bg-blue-600"
                                                                onClick={() => {
                                                                    const downloadLink = document.createElement('a');
                                                                    downloadLink.href = attachment.data;
                                                                    downloadLink.download = attachment.name;
                                                                    document.body.appendChild(downloadLink);
                                                                    downloadLink.click();
                                                                    document.body.removeChild(downloadLink);
                                                                }}
                                                                title={`Download ${attachment.name}`}
                                                            >
                                                                Download
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            <footer className="w-full bg-gray-300 p-4 flex items-center flex-shrink-0">
                <textarea 
                    ref={textareaRef}
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type your message..." 
                    className="flex-grow rounded-md border-gray-400 shadow-sm p-2 min-h-[40px] max-h-[200px] resize-none overflow-y-auto"
                />
                <button 
                    className="bg-blue-500 text-white rounded-md px-4 py-2 ml-2"
                    onClick={handleFileSelect}
                    disabled={!gs.connected}
                    title={selectedFiles.length === 0 ? 'Attach files' : `${selectedFiles.length} file(s) attached`}
                >
                    {selectedFiles.length ? `📎(${selectedFiles.length})` : '📎'}
                </button>
                <button 
                    className="bg-green-500 text-white rounded-md px-4 py-2 ml-2"
                    onClick={send}
                    disabled={!gs.connected}
                >
                    Send
                </button>
            </footer>
            
            {/* Full-size image viewer modal */}
            {fullSizeImage && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 overflow-auto"
                    onClick={() => setFullSizeImage(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <button 
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFullSizeImage(null);
                            }}
                        >
                            ✕
                        </button>
                        <div className="bg-white p-2 rounded shadow-lg">
                            <h3 className="text-center text-lg font-medium mb-2">{fullSizeImage.name}</h3>
                            <img 
                                src={fullSizeImage.src} 
                                alt={fullSizeImage.name}
                                className="max-w-full max-h-[80vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default QuantaChat;