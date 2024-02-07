/* eslint-disable complexity */
import {ChatInputCommandInteraction, GuildMember} from 'discord.js';
import {URL} from 'node:url';
import {inject, injectable} from 'inversify';
import shuffle from 'array-shuffle';
import {TYPES} from '../types.js';
import GetSongs from '../services/get-songs.js';
import {SongMetadata, STATUS} from './player.js';
import PlayerManager from '../managers/player.js';
import {buildPlayingMessageEmbed} from '../utils/build-embed.js';
import {getMemberVoiceChannel, getMostPopularVoiceChannel} from '../utils/channels.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';

@injectable()
export default class AddQueryToQueue {
  constructor(@inject(TYPES.Services.GetSongs) private readonly getSongs: GetSongs, @inject(TYPES.Managers.Player) private readonly playerManager: PlayerManager) {
  }

  public async addToQueue({
    query,
    addToFrontOfQueue,
    shuffleAdditions,
    shouldSplitChapters,
    interaction,
  }: {
    query: string;
    addToFrontOfQueue: boolean;
    shuffleAdditions: boolean;
    shouldSplitChapters: boolean;
    interaction: ChatInputCommandInteraction;
  }): Promise<void> {
    const guildId = interaction.guild!.id;
    const player = this.playerManager.get(guildId);
    const wasPlayingSong = player.getCurrent() !== null;

    const [targetVoiceChannel] = getMemberVoiceChannel(interaction.member as GuildMember) ?? getMostPopularVoiceChannel(interaction.guild!);

    const settings = await getGuildSettings(guildId);

    const {playlistLimit} = settings;

    await interaction.deferReply();

    let newSongs: SongMetadata[] = [];
    let extraMsg = '';

    // Test if it's a complete URL
    try {
      const url = new URL(query);

      const YOUTUBE_HOSTS = [
        'www.youtube.com',
        'youtu.be',
        'youtube.com',
        'music.youtube.com',
        'www.music.youtube.com',
      ];

      if (YOUTUBE_HOSTS.includes(url.host)) {
        // YouTube source
        if (url.searchParams.get('list')) {
          // YouTube playlist
          newSongs.push(...await this.getSongs.youtubePlaylist(url.searchParams.get('list')!, shouldSplitChapters));
        } else {
          const songs = await this.getSongs.youtubeVideo(url.href, shouldSplitChapters);

          if (songs) {
            newSongs.push(...songs);
          } else {
            throw new Error('isso não existe');
          }
        }
      } else if (url.protocol === 'spotify:' || url.host === 'open.spotify.com') {
        const [convertedSongs, nSongsNotFound, totalSongs] = await this.getSongs.spotifySource(query, playlistLimit, shouldSplitChapters);

        if (totalSongs > playlistLimit) {
          extraMsg = `uma amostra aleatória de ${playlistLimit} músicas foi coletada`;
        }

        if (totalSongs > playlistLimit && nSongsNotFound !== 0) {
          extraMsg += ' e ';
        }

        if (nSongsNotFound !== 0) {
          if (nSongsNotFound === 1) {
            extraMsg += '1 música não foi encontrada';
          } else {
            extraMsg += `${nSongsNotFound.toString()} músicas não foram encontradas`;
          }
        }

        newSongs.push(...convertedSongs);
      } else {
        const song = await this.getSongs.httpLiveStream(query);

        if (song) {
          newSongs.push(song);
        } else {
          throw new Error('isso não existe');
        }
      }
    } catch (_: unknown) {
      // Not a URL, must search YouTube
      const songs = await this.getSongs.youtubeVideoSearch(query, shouldSplitChapters);

      if (songs) {
        newSongs.push(...songs);
      } else {
        throw new Error('isso não existe');
      }
    }

    if (newSongs.length === 0) {
      throw new Error('nenhuma música encontrada');
    }

    if (shuffleAdditions) {
      newSongs = shuffle(newSongs);
    }

    newSongs.forEach(song => {
      player.add({
        ...song,
        addedInChannelId: interaction.channel!.id,
        requestedBy: interaction.member!.user.id,
      }, {immediate: addToFrontOfQueue ?? false});
    });

    const firstSong = newSongs[0];

    let statusMsg = '';

    if (player.voiceConnection === null) {
      await player.connect(targetVoiceChannel);

      // Resume / start playback
      await player.play();

      if (wasPlayingSong) {
        statusMsg = 'retomando a reprodução';
      }

      await interaction.editReply({
        embeds: [buildPlayingMessageEmbed(player)],
      });
    } else if (player.status === STATUS.IDLE) {
      // Player is idle, start playback instead
      await player.play();
    }

    // Build response message
    if (statusMsg !== '') {
      if (extraMsg === '') {
        extraMsg = statusMsg;
      } else {
        extraMsg = `${statusMsg}, ${extraMsg}`;
      }
    }

    if (extraMsg !== '') {
      extraMsg = ` (${extraMsg})`;
    }

    if (newSongs.length === 1) {
      await interaction.editReply(`Jaé, **${firstSong.title}** foi adicionado ao${addToFrontOfQueue ? ' na frente de' : ''} fila${extraMsg}`);
    } else {
      await interaction.editReply(`Jaé, **${firstSong.title}** e ${newSongs.length - 1} outras músicas foram adicionadas à fila${extraMsg}`);
    }
  }
}
