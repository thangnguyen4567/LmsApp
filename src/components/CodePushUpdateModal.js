import React, {useCallback, useEffect, useState} from 'react';
import {
	ActivityIndicator,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import CodePush from '@revopush/react-native-code-push';

function CodePushUpdateModal({update, onDismiss}) {
	const [busy, setBusy] = useState(false);
	const [received, setReceived] = useState(0);
	const [total, setTotal] = useState(0);

	useEffect(() => {
		if (!update) {
			setBusy(false);
			setReceived(0);
			setTotal(0);
		}
	}, [update]);

  	const pct = total > 0 ? Math.round((received / total) * 100) : busy ? 0 : 0;

  	const handleInstall = useCallback(async () => {
		if (!update) {
			return;
		}
		setBusy(true);
		setReceived(0);
		setTotal(0);
		try {
			const local = await update.download(p => {
				setReceived(p.receivedBytes);
				setTotal(p.totalBytes);
			});
		await local.install(CodePush.InstallMode.IMMEDIATE);
			CodePush.restartApp();
		} finally {
			setBusy(false);
		}
  	}, [update]);

	const handleLater = useCallback(() => {
		if (update?.isMandatory || busy) {
			return;
		}
		onDismiss();
	}, [update?.isMandatory, busy, onDismiss]);

  	const visible = update != null;

	return (
		<Modal visible={visible} transparent animationType="fade">
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Text style={styles.title}>Cập nhật mới</Text>
					<Text style={styles.desc}>Đã có phiên bản mới cho ứng dụng.</Text>
					{busy && (
						<View style={styles.row}>
							<ActivityIndicator />
							<Text style={styles.progress}>Đang tải… {pct}%</Text>
						</View>
					)}
					<View style={styles.actions}>
						{!update?.isMandatory && (
							<Pressable
								style={[styles.btn, styles.btnGhost]}
								onPress={handleLater}
								disabled={busy}>
								<Text>Để sau</Text>
							</Pressable>
						)}
						<Pressable
							style={[styles.btn, styles.btnPrimary]}
							onPress={() => handleInstall()}
							disabled={busy}
						>
							<Text style={styles.btnPrimaryText}>
								{update?.isMandatory ? 'Cập nhật ngay' : 'Cập nhật'}
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.45)',
		justifyContent: 'center',
		padding: 24,
	},
	card: {
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 20,
	},
	title: {fontSize: 18, fontWeight: '700', marginBottom: 8},
	desc: {fontSize: 15, color: '#333', marginBottom: 16},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 12,
	},
	progress: {fontSize: 14},
	actions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12},
	btn: {paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10},
	btnGhost: {backgroundColor: '#eee'},
	btnPrimary: {backgroundColor: '#0a7ea4'},
	btnPrimaryText: {color: '#fff', fontWeight: '600'},
});

export default CodePushUpdateModal;
