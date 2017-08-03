import VideoPlayer from 'react-native-video-player';
import _ from 'lodash';
const React = require('react');
const ReactNative = require('react-native');
const flattenStyle = ReactNative.StyleSheet.flatten;
const VideoCacheProvider = require('./VideoCacheProvider');

const {
    Image,
    ActivityIndicator,
    NetInfo,
    Platform,
    StyleSheet,
    Dimensions,
} = ReactNative;

const styles = StyleSheet.create({
    video: {
        backgroundColor: 'transparent',
        minHeight: 50,
        minWidth: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loader: {
        backgroundColor: 'transparent',
    },
    loaderPlaceholder: {
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center'
    }
});

function getVideoProps(props) {
    return _.omit(props, ['source', 'defaultSource', 'activityIndicatorProps', 'style', 'useQueryParamsInCacheKey', 'renderVideo', 'resolveHeaders']);
}

const CACHED_VIDEO_REF = 'cachedVideo';

const CachedVideo = React.createClass({
    propTypes: {
        renderVideo: React.PropTypes.func.isRequired,
        activityIndicatorProps: React.PropTypes.object.isRequired,
        useQueryParamsInCacheKey: React.PropTypes.oneOfType([
            React.PropTypes.bool,
            React.PropTypes.array
        ]).isRequired,
        resolveHeaders: React.PropTypes.func,
        thumbnail: Image.propTypes.source,
        style: React.PropTypes.oneOfType([
            React.PropTypes.object,
            React.PropTypes.any
        ]),
        disableControlsAutoHide: React.PropTypes.bool,
        endWithThumbnail: React.PropTypes.bool,
        videoWidth: React.PropTypes.number,
        videoHeight: React.PropTypes.number,
    },

    getDefaultProps() {
        return {
            renderVideo: props => (
              <VideoPlayer
                ref={CACHED_VIDEO_REF}
                {...props}
              />
            ),
            activityIndicatorProps: {},
            useQueryParamsInCacheKey: false,
            resolveHeaders: () => Promise.resolve({}),
            thumbnail: null,
            style: null,
            disableControlsAutoHide: true,
            endWithThumbnail: true,
            videoWidth: Dimensions.get('window').width,
            videoHeight: Dimensions.get('window').height / 2,
        };
    },

    setNativeProps(nativeProps) {
        try {
            this.refs[CACHED_VIDEO_REF].setNativeProps(nativeProps);
        } catch (e) {
            console.error(e);
        }
    },

    getInitialState() {
        this._isMounted = false;
        return {
            isCacheable: false,
            cachedVideoPath: null,
            networkAvailable: true
        };
    },

    safeSetState(newState) {
        if (!this._isMounted) {
            return;
        }
        return this.setState(newState);
    },

    componentWillMount() {
        this._isMounted = true;
        NetInfo.isConnected.addEventListener('change', this.handleConnectivityChange);
        // initial
        NetInfo.isConnected.fetch()
            .then(isConnected => {
                this.safeSetState({
                    networkAvailable: isConnected
                });
            });

        this.processSource(this.props.source);
    },

    componentWillUnmount() {
        this._isMounted = false;
        NetInfo.isConnected.removeEventListener('change', this.handleConnectivityChange);
    },

    componentWillReceiveProps(nextProps) {
        if (!_.isEqual(this.props.source, nextProps.source)) {
            this.processSource(nextProps.source);
        }
    },

    handleConnectivityChange(isConnected) {
        this.safeSetState({
            networkAvailable: isConnected
        });
    },

    processSource(source) {
        const url = _.get(source, ['uri'], null);
        if (VideoCacheProvider.isCacheable(url)) {
            const options = _.pick(this.props, ['useQueryParamsInCacheKey', 'cacheGroup']);
            // try to get the video path from cache
            VideoCacheProvider.getCachedVideoPath(url, options)
                // try to put the video in cache if
                .catch(() => VideoCacheProvider.cacheVideo(url, options, this.props.resolveHeaders))
                .then(cachedVideoPath => {
                    this.safeSetState({
                        cachedVideoPath
                    });
                })
                .catch(err => {
                    this.safeSetState({
                        cachedVideoPath: null,
                        isCacheable: false
                    });
                });
            this.safeSetState({
                isCacheable: true
            });
        } else {
            this.safeSetState({
                isCacheable: false
            });
        }
    },

    render() {
        if (this.state.isCacheable && !this.state.cachedVideoPath) {
            return this.renderLoader();
        }
        const props = getVideoProps(this.props);
        const style = this.props.style || styles.video;
        const source = (this.state.isCacheable && this.state.cachedVideoPath) ? {
                uri: 'file://' + this.state.cachedVideoPath
            } : this.props.source;
        return this.props.renderVideo({
            ...props,
            disableControlsAutoHide: this.props.disableControlsAutoHide,
            videoWidth: this.props.videoWidth,
            videoHeight: this.props.videoHeight,
            key: props.key || source.uri,
            style,
            endWithThumbnail: this.props.endWithThumbnail,
            thumbnail: this.props.thumbnail,
            video: source
        });
    },

    renderLoader() {
        const videoProps = getVideoProps(this.props);
        const videoStyle = [this.props.style, styles.loaderPlaceholder];
        const activityIndicatorProps = _.omit(this.props.activityIndicatorProps, ['style']);
        const activityIndicatorStyle = this.props.activityIndicatorProps.style || styles.loader;
        const source = this.props.defaultSource;
        if (!source || (Platform.OS === 'android' && flattenStyle(videoStyle).borderRadius)) {
            return (
                <ActivityIndicator
                    {...activityIndicatorProps}
                    style={[videoStyle, activityIndicatorStyle]}/>
            );
        }
        return this.props.renderVideo({
            ...videoProps,
            style: videoStyle,
            disableControlsAutoHide: this.props.disableControlsAutoHide,
            videoWidth: this.props.videoWidth,
            videoHeight: this.props.videoHeight,
            key: source.uri,
            endWithThumbnail: this.props.endWithThumbnail,
            thumbnail: this.props.thumbnail,
            video: source,
            children: (
                <ActivityIndicator
                    {...activityIndicatorProps}
                    style={activityIndicatorStyle}/>
            )
        });
    }
});

module.exports = CachedVideo;
