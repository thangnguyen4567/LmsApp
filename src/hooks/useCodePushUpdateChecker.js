import {useCallback, useEffect, useState} from 'react';
import {AppState} from 'react-native';
import CodePush from '@revopush/react-native-code-push';

export function useCodePushUpdateChecker() {
	const [remote, setRemote] = useState(null);

	const checkForUpdate = useCallback(async () => {
		try {
			const update = await CodePush.checkForUpdate();
			setRemote(update);
		} catch {
			// Nothing
		}
	}, []);

	useEffect(() => {
		checkForUpdate();
		const onChange = s => {
			if (s === 'active') {
				checkForUpdate();
			}
		};
		const sub = AppState.addEventListener('change', onChange);
		return () => sub.remove();
	}, [checkForUpdate]);

	const dismiss = useCallback(() => {
		setRemote(null);
	}, []);

	return {remote, dismiss, checkForUpdate};
}
