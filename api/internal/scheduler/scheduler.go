package scheduler

import (
	"time"

	"github.com/robfig/cron/v3"

	"blognews/internal/services"
)

func Start(svc *services.NewsService, morningSpec, eveningSpec, tz string) {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}

	c := cron.New(
		cron.WithLocation(loc),
		cron.WithParser(cron.NewParser(
			cron.Minute|cron.Hour|cron.Dom|cron.Month|cron.Dow|cron.Descriptor,
		)),
	)

	addJob := func(spec string) {
		c.AddFunc(spec, func() {
			svc.FetchAndSave()
		})
	}

	addJob(morningSpec)
	addJob(eveningSpec)
	c.Start()
}
