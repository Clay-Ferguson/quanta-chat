import ContactsListComp from '../components/ContactsListComp';
import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { useEffect } from 'react';
import { util } from '../Util';

/**
 * Page for displaying the list of contacts.
 */
export default function ContactsPage() {
    useEffect(() => util.resizeEffect(), []);
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Contacts"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="contactsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="contactsList" className="space-y-3">
                    <ContactsListComp />
                </div>
            </div>
        </div>
    );
}
