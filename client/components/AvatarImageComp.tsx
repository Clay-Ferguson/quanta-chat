import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { util } from "../Util";
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser";
import appUsers from "../AppUsers";

interface AvatarImageCompProps {
    publicKey: string;
    name: string;
}

/**
 * Displays an avatar image for a user. If the image fails to load, a default icon is shown.
 */
export default function AvatarImageComp({ name, publicKey }: AvatarImageCompProps) {
    return (
        <>
            <img 
                src={`/api/users/${encodeURIComponent(publicKey)}/avatar`} 
                alt={`${name}'s avatar`} 
                className="w-10 h-10 rounded-full object-cover border border-gray-600 cursor-pointer"
                onError={util.onAvatarError}
                onClick={() => appUsers.showUserProfile(publicKey!)}
            />
            <div className="w-10 h-10 bg-gray-700 rounded-full items-center justify-center hidden">
                <FontAwesomeIcon icon={faUser} className="text-gray-400 text-lg" />
            </div>
        </>
    );
}
