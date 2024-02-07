import {inject, injectable} from 'inversify';
import {ChatInputCommandInteraction} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {TYPES} from '../types.js';
import PlayerManager from '../managers/player.js';
import Command from '.';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('limpa todas as músicas na fila, exceto a que está sendo reproduzida no momento');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    this.playerManager.get(interaction.guild!.id).clear();

    await interaction.reply('Mais limpo que o rio tietê');
  }
}
