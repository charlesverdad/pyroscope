package server

import (
	"context"
	"fmt"
	"mime"
	"net/http"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/pyroscope-io/pyroscope/pkg/agent/types"
	"github.com/pyroscope-io/pyroscope/pkg/parser"
	"github.com/pyroscope-io/pyroscope/pkg/server/httputils"
	"github.com/pyroscope-io/pyroscope/pkg/storage"
	"github.com/pyroscope-io/pyroscope/pkg/storage/metadata"
	"github.com/pyroscope-io/pyroscope/pkg/storage/segment"
	"github.com/pyroscope-io/pyroscope/pkg/util/attime"
)

type Parser interface {
	Put(context.Context, *parser.PutInput) error
}

type ingestHandler struct {
	log       *logrus.Logger
	parser    Parser
	onSuccess func(pi *parser.PutInput)
	httpUtils httputils.Utils
}

func (ctrl *Controller) ingestHandler() http.Handler {
	p := parser.New(ctrl.log, ctrl.putter, ctrl.exporter)
	return NewIngestHandler(ctrl.log, p, func(pi *parser.PutInput) {
		ctrl.StatsInc("ingest")
		ctrl.StatsInc("ingest:" + pi.SpyName)
		ctrl.appStats.Add(hashString(pi.Key.AppName()))
	}, ctrl.httpUtils)
}

func NewIngestHandler(log *logrus.Logger, p Parser, onSuccess func(pi *parser.PutInput), httpUtils httputils.Utils) http.Handler {
	return ingestHandler{
		log:       log,
		parser:    p,
		onSuccess: onSuccess,
		httpUtils: httpUtils,
	}
}

func (h ingestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	pi, err := h.ingestParamsFromRequest(r)
	if err != nil {
		h.httpUtils.WriteError(r, w, http.StatusBadRequest, err, "invalid parameter")
		return
	}

	err = h.parser.Put(r.Context(), pi)
	switch {
	case err == nil:
		h.onSuccess(pi)
	case storage.IsIngestionError(err):
		h.httpUtils.WriteError(r, w, http.StatusInternalServerError, err, "error happened while ingesting data")
	default:
		h.httpUtils.WriteError(r, w, http.StatusUnprocessableEntity, err, "error happened while parsing request body")
	}
}

func (h ingestHandler) ingestParamsFromRequest(r *http.Request) (*parser.PutInput, error) {
	var (
		q   = r.URL.Query()
		pi  parser.PutInput
		err error
	)

	pi.Format = q.Get("format")
	pi.ContentType = r.Header.Get("Content-Type")
	pi.Body = r.Body
	pi.MultipartBoundary = boundaryFromRequest(r)

	pi.Key, err = segment.ParseKey(q.Get("name"))
	if err != nil {
		return nil, fmt.Errorf("name: %w", err)
	}

	if qt := q.Get("from"); qt != "" {
		pi.StartTime = attime.Parse(qt)
	} else {
		pi.StartTime = time.Now()
	}

	if qt := q.Get("until"); qt != "" {
		pi.EndTime = attime.Parse(qt)
	} else {
		pi.EndTime = time.Now()
	}

	if sr := q.Get("sampleRate"); sr != "" {
		sampleRate, err := strconv.Atoi(sr)
		if err != nil {
			h.log.WithError(err).Errorf("invalid sample rate: %q", sr)
			pi.SampleRate = types.DefaultSampleRate
		} else {
			pi.SampleRate = uint32(sampleRate)
		}
	} else {
		pi.SampleRate = types.DefaultSampleRate
	}

	if sn := q.Get("spyName"); sn != "" {
		// TODO: error handling
		pi.SpyName = sn
	} else {
		pi.SpyName = "unknown"
	}

	if u := q.Get("units"); u != "" {
		// TODO(petethepig): add validation for these?
		pi.Units = metadata.Units(u)
	} else {
		pi.Units = metadata.SamplesUnits
	}

	if at := q.Get("aggregationType"); at != "" {
		// TODO(petethepig): add validation for these?
		pi.AggregationType = metadata.AggregationType(at)
	} else {
		pi.AggregationType = metadata.SumAggregationType
	}

	return &pi, nil
}

func boundaryFromRequest(r *http.Request) string {
	v := r.Header.Get("Content-Type")
	if v == "" {
		return ""
	}
	d, params, err := mime.ParseMediaType(v)
	if err != nil || !(d == "multipart/form-data") {
		return ""
	}
	boundary, ok := params["boundary"]
	if !ok {
		return ""
	}
	return boundary
}
