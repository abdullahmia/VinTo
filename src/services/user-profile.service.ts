import { IUserProfile } from '@/models';
import * as vscode from 'vscode';

export class UserProfileService {
	private static readonly KEY = 'personal-todo-list.userProfile';

	constructor(private context: vscode.ExtensionContext) { }

	/**
	 * Get the user profile from global state
	 */
	getProfile(): IUserProfile | undefined {
		return this.context.globalState.get<IUserProfile>(UserProfileService.KEY);
	}

	/**
	 * Set the user profile in global state
	 */
	async setProfile(profile: IUserProfile): Promise<void> {
		await this.context.globalState.update(UserProfileService.KEY, profile);
	}

	/**
	 * Check if a user profile exists
	 */
	hasProfile(): boolean {
		return this.getProfile() !== undefined;
	}

	hasCompletedOnboarding(requiredVersion: number = 1): boolean {
		const profile = this.getProfile();
		return !!profile && (profile.onboardingVersion || 0) >= requiredVersion;
	}

	/**
	 * Update the user profile with partial data
	 */
	async updateProfile(updates: Partial<IUserProfile>): Promise<void> {
		const currentProfile = this.getProfile();
		if (!currentProfile) {
			throw new Error('No profile exists to update');
		}

		const updatedProfile: IUserProfile = {
			...currentProfile,
			...updates,
			updatedAt: Date.now()
		};

		await this.setProfile(updatedProfile);
	}

	/**
	 * Clear the user profile (for testing/debugging)
	 */
	async clearProfile(): Promise<void> {
		await this.context.globalState.update(UserProfileService.KEY, undefined);
	}
}
