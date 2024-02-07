import {ChatInputCommandInteraction} from 'discord.js';
import {TYPES} from '../types.js';
import {inject, injectable} from 'inversify';
import PlayerManager from '../managers/player.js';
import Command from '.';
import {SlashCommandBuilder} from '@discordjs/builders';
import {buildPlayingMessageEmbed} from '../utils/build-embed.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('now-playing')
    .setDescription('shows the currently played song');

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const player = this.playerManager.get(interaction.guild!.id);

    if (!player.getCurrent()) {
      throw new Error('nothing is currently playing');
    }

    await interaction.reply({
      embeds: [buildPlayingMessageEmbed(player)],
      components: [
        {
          type: 1,
          components: [
            {
              style: 1,
              label: '⏮️',
              custom_id: 'back-button',
              disabled: false,
              type: 2,
            },
            {
              style: 1,
              label: '⏯️',
              custom_id: 'play-pause-button',
              disabled: false,
              type: 2,
            },
            {
              style: 1,
              label: '⏭️',
              custom_id: 'skip-button',
              disabled: false,
              type: 2,
            },
            {
              style: 1,
              label: '🔀',
              custom_id: 'shuffle-button',
              disabled: false,
              type: 2,
            },
            {
              style: 1,
              label: '⏹️',
              custom_id: 'stop-button',
              disabled: false,
              type: 2,
            },
            {
              style: 1,
              label: '🚮',
              custom_id: 'clean-button',
              disabled: false,
              type: 2,
            },
          ],
        },
      ],
    });
  }
}
